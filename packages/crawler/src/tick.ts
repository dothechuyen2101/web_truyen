import { prisma, type Source } from "@truyen/db";
import { detectChapterAds } from "./ads";
import { discoverLatest, syncTracked, withCrawlRun, withoutSkipped } from "./sync";

export interface TickOptions {
  /** Thời gian tối đa cho cả đợt (ms) — không bắt đầu việc mới khi sắp hết */
  budgetMs: number;
  /** Số trang "mới cập nhật" quét mỗi nguồn */
  discoveryPages?: number;
  /** Số trang backfill xử lý mỗi lượt */
  backfillPages?: number;
}

export interface TickStats {
  sources: number;
  checked: number;
  synced: number;
  failed: number;
  backfillPages: number;
  adChecks: number;
  durationMs: number;
}

/** Một lần đồng bộ truyện có thể mất vài chục giây — còn ít hơn ngần này thì không bắt đầu truyện mới */
const MIN_TIME_FOR_SYNC_MS = 25_000;
const MIN_TIME_FOR_AD_CHECK_MS = 8_000;
/** Đợt chạy RUNNING lâu hơn thế này là đã bị ngắt (function hết thời gian) */
const STALE_RUN_MS = 15 * 60_000;
const CRAWL_RUN_RETENTION_DAYS = 30;
/** Khoá tự hết hạn sau ngân sách + khoảng này (phòng khi tiến trình bị ngắt, không kịp nhả khoá) */
const LOCK_GRACE_MS = 5 * 60_000;

/**
 * Lấy khoá nguyên tử: chỉ một request lấy được kể cả khi hai lần gọi tới cùng lúc.
 * Dùng bảng thay cho advisory lock vì pooler Supabase (chế độ transaction) không giữ phiên.
 */
async function acquireLock(name: string, ttlMs: number) {
  const until = new Date(Date.now() + ttlMs);
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "CrawlLock" (name, "lockedUntil") VALUES (${name}, ${until})
    ON CONFLICT (name) DO UPDATE SET "lockedUntil" = EXCLUDED."lockedUntil"
    WHERE "CrawlLock"."lockedUntil" < now()
    RETURNING name`;
  return rows.length > 0;
}

async function releaseLock(name: string) {
  await prisma.crawlLock.updateMany({ where: { name }, data: { lockedUntil: new Date(0) } });
}

/**
 * Một đợt crawl có giới hạn thời gian — thay cho worker chạy liên tục, để chạy được trên
 * serverless (Vercel cron, cron-job.org) hoặc trong vòng lặp của worker trên VPS.
 * Mỗi nguồn chạy song song (khác host nên không vướng giới hạn tốc độ của nhau):
 * quét trang mới cập nhật → đồng bộ truyện mới/có chương mới → chạy tiếp backfill nếu đang bật.
 * Thời gian còn lại dùng để nhận diện ảnh quảng cáo trong các chương truyện tranh mới tải.
 */
export async function runCrawlTick({
  budgetMs,
  discoveryPages = 2,
  backfillPages = 2,
}: TickOptions) {
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;
  const timeLeft = () => deadline - Date.now();

  if (!(await acquireLock("tick", budgetMs + LOCK_GRACE_MS))) {
    return { skipped: "Đợt crawl trước vẫn đang chạy" };
  }
  try {
    await prisma.crawlRun.updateMany({
      where: { status: "RUNNING", startedAt: { lt: new Date(startedAt - STALE_RUN_MS) } },
      data: {
        status: "FAILED",
        error: "Bị ngắt giữa chừng (hết thời gian chạy)",
        finishedAt: new Date(),
      },
    });
    return await tick();
  } finally {
    await releaseLock("tick");
  }

  function tick() {
    return withCrawlRun("tick", {}, async (): Promise<TickStats> => {
      const stats: TickStats = {
        sources: 0,
        checked: 0,
        synced: 0,
        failed: 0,
        backfillPages: 0,
        adChecks: 0,
        durationMs: 0,
      };

      async function syncAll(source: Source, paths: string[]) {
        for (const path of await withoutSkipped(source.id, paths)) {
          if (timeLeft() < MIN_TIME_FOR_SYNC_MS) return false;
          try {
            await syncTracked(source, path);
            stats.synced++;
          } catch {
            stats.failed++;
          }
        }
        return true;
      }

      async function crawlSource(source: Source) {
        try {
          const latest = await withCrawlRun("discovery", { sourceId: source.id }, () =>
            discoverLatest(source, { pages: discoveryPages }),
          );
          stats.checked += latest.checked;
          if (!(await syncAll(source, latest.toSync))) return;

          // Backfill: duyệt dần toàn bộ danh sách của nguồn qua nhiều đợt.
          let page = source.backfillPage;
          while (page !== null && timeLeft() > MIN_TIME_FOR_SYNC_MS) {
            const chunk = await withCrawlRun(
              "backfill",
              { sourceId: source.id, target: `trang ${page}–${page + backfillPages - 1}` },
              () => discoverLatest(source, { fromPage: page!, pages: backfillPages }),
            );
            stats.backfillPages += chunk.pages;
            // Hết giờ giữa chừng → giữ nguyên trang, đợt sau làm tiếp (truyện đã đồng bộ sẽ không lặp lại).
            if (!(await syncAll(source, chunk.toSync))) return;
            page = chunk.pages === backfillPages ? page + backfillPages : null;
            await prisma.source.update({ where: { id: source.id }, data: { backfillPage: page } });
          }
        } catch (error) {
          await prisma.source.update({
            where: { id: source.id },
            data: { lastError: error instanceof Error ? error.message : String(error) },
          });
        }
      }

      const sources = await prisma.source.findMany({ where: { enabled: true } });
      stats.sources = sources.length;
      await Promise.all(sources.map(crawlSource));

      // Nhận diện ảnh quảng cáo cho các chương truyện tranh chưa kiểm tra (chỉ khi đã có mẫu).
      if (await prisma.adFingerprint.count()) {
        const pending = await prisma.chapterContent.findMany({
          where: { adCheckedAt: null, text: null },
          orderBy: { fetchedAt: "desc" },
          take: 50,
          select: { chapterId: true },
        });
        for (const { chapterId } of pending) {
          if (timeLeft() < MIN_TIME_FOR_AD_CHECK_MS) break;
          await detectChapterAds(chapterId).catch(() => {});
          stats.adChecks++;
        }
      }

      await prisma.crawlRun.deleteMany({
        where: {
          startedAt: { lt: new Date(startedAt - CRAWL_RUN_RETENTION_DAYS * 24 * 3600 * 1000) },
        },
      });
      await prisma.crawlSkip.deleteMany({ where: { until: { lt: new Date() } } });

      stats.durationMs = Date.now() - startedAt;
      return stats;
    });
  }
}
