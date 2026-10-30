import { UnrecoverableError, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@truyen/db";
import { detectChapterAds } from "@truyen/crawler/ads";
import {
  HttpError,
  discoverLatest,
  fetchChapterContent,
  syncStory,
  withCrawlRun,
} from "@truyen/crawler";
import {
  PRIORITY,
  QUEUE,
  closeQueues,
  enqueue,
  getQueues,
  redisConnection,
  type ContentJob,
  type DiscoveryJob,
  type SyncJob,
} from "@truyen/crawler/queue";

const DISCOVERY_EVERY_MS = 15 * 60 * 1000;
/** Số trang "mới cập nhật" quét mỗi lần discovery */
const DISCOVERY_PAGES = 2;
/** Số trang mỗi job backfill xử lý trước khi xếp job kế tiếp */
const BACKFILL_PAGES_PER_JOB = 5;
const CRAWL_RUN_RETENTION_DAYS = 30;
const FLUSH_VIEWS_EVERY_MS = 5 * 60 * 1000;
/** Truyện bị nguồn chặn (403, vd Cloudflare challenge) hoặc đã xoá (404) được bỏ qua trong khoảng này */
const SKIP_BLOCKED_SECONDS = 7 * 24 * 3600;

const connection = redisConnection();
const redis = new Redis(connection.url);

const skipKey = (sourceId: number, path: string) => `crawl:skip:${sourceId}:${path}`;

/** Bỏ những path đang trong danh sách bỏ qua. */
async function withoutSkipped(sourceId: number, paths: string[]) {
  if (!paths.length) return paths;
  const flags = await redis.mget(paths.map((p) => skipKey(sourceId, p)));
  return paths.filter((_, i) => flags[i] === null);
}

async function enabledSource(id: number | undefined) {
  if (!id) return null;
  const source = await prisma.source.findUnique({ where: { id } });
  return source?.enabled ? source : null;
}

async function handleDiscovery(job: Job<DiscoveryJob>) {
  if (job.name === "discover-all") {
    const sources = await prisma.source.findMany({ where: { enabled: true }, select: { id: true } });
    for (const s of sources) await enqueue.discovery({ sourceId: s.id, pages: DISCOVERY_PAGES });
    return { sources: sources.length };
  }

  if (job.name === "flush-views") return flushViews();

  if (job.name === "cleanup") {
    const before = new Date(Date.now() - CRAWL_RUN_RETENTION_DAYS * 24 * 3600 * 1000);
    const { count } = await prisma.crawlRun.deleteMany({ where: { startedAt: { lt: before } } });
    return { deletedRuns: count };
  }

  const source = await enabledSource(job.data.sourceId);
  if (!source) return { skipped: "nguồn không tồn tại hoặc đã tắt" };

  const { backfill = false, fromPage = 1 } = job.data;
  const pages = job.data.pages ?? (backfill ? BACKFILL_PAGES_PER_JOB : DISCOVERY_PAGES);
  const result = await withCrawlRun(
    backfill ? "backfill" : "discovery",
    { sourceId: source.id, target: `trang ${fromPage}–${fromPage + pages - 1}` },
    () => discoverLatest(source, { fromPage, pages }),
  );

  const toSync = await withoutSkipped(source.id, result.toSync);
  for (const path of toSync) {
    await enqueue.sync({ sourceId: source.id, path }, backfill ? PRIORITY.backfill : PRIORITY.normal);
  }
  // Còn trang tiếp theo → xếp đoạn backfill kế tiếp.
  if (backfill && result.pages === pages) {
    await enqueue.discovery({ sourceId: source.id, backfill: true, fromPage: fromPage + pages, pages });
  }
  return { checked: result.checked, queued: toSync.length, skipped: result.toSync.length - toSync.length };
}

/** Lượt xem được web cộng dồn trong Redis (hash views:pending) — ghi xuống DB theo lô. */
async function flushViews() {
  const batchKey = `views:flushing:${Date.now()}`;
  try {
    await redis.rename("views:pending", batchKey);
  } catch {
    return { stories: 0 }; // chưa có lượt xem mới
  }
  const counts = Object.entries(await redis.hgetall(batchKey));
  for (const [storyId, views] of counts) {
    await prisma.story.updateMany({
      where: { id: Number(storyId) },
      data: { viewCount: { increment: Number(views) } },
    });
  }
  await redis.del(batchKey);
  return { stories: counts.length };
}

async function handleSync(job: Job<SyncJob>) {
  const source = await enabledSource(job.data.sourceId);
  if (!source) return { skipped: "nguồn không tồn tại hoặc đã tắt" };
  const { path } = job.data;
  try {
    return await withCrawlRun("syncStory", { sourceId: source.id, target: path }, () =>
      syncStory(source, path),
    );
  } catch (error) {
    await prisma.storySource.updateMany({
      where: { sourceId: source.id, path },
      data: { lastError: error instanceof Error ? error.message : String(error) },
    });
    // Nguồn chặn hoặc truyện đã bị xoá: thử lại vô ích, tạm bỏ qua path này.
    if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
      await redis.set(skipKey(source.id, path), String(error.status), "EX", SKIP_BLOCKED_SECONDS);
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }
}

async function handleContent(job: Job<ContentJob>) {
  const { chapterId } = job.data;
  if (job.name === "detect-ads") return detectChapterAds(chapterId);
  const exists = await prisma.chapterContent.findUnique({
    where: { chapterId },
    select: { chapterId: true },
  });
  if (exists) return { skipped: "đã có nội dung" };
  const content = await fetchChapterContent(chapterId);
  if (content.images) await enqueue.ads(chapterId);
  return { sourceId: content.sourceId };
}

const workers = [
  new Worker<DiscoveryJob>(QUEUE.discovery, handleDiscovery, { connection, concurrency: 1 }),
  new Worker<SyncJob>(QUEUE.sync, handleSync, { connection, concurrency: 2 }),
  new Worker<ContentJob>(QUEUE.content, handleContent, { connection, concurrency: 3 }),
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    console.error(`[${worker.name}] ✘ ${job?.name} ${JSON.stringify(job?.data)}: ${error.message}`);
  });
  worker.on("completed", (job, result) => {
    if (worker.name !== QUEUE.content && job.name !== "flush-views") {
      console.log(`[${worker.name}] ✔ ${job.name} ${JSON.stringify(job.data)} → ${JSON.stringify(result)}`);
    }
  });
}

const { discovery } = getQueues();
await discovery.upsertJobScheduler(
  "discover-all",
  { every: DISCOVERY_EVERY_MS },
  { name: "discover-all", data: {} },
);
await discovery.upsertJobScheduler(
  "flush-views",
  { every: FLUSH_VIEWS_EVERY_MS },
  { name: "flush-views", data: {} },
);
await discovery.upsertJobScheduler("cleanup", { pattern: "0 4 * * *" }, { name: "cleanup", data: {} });
console.log(`Worker đã chạy — discovery mỗi ${DISCOVERY_EVERY_MS / 60000} phút`);

async function shutdown() {
  console.log("Đang dừng worker…");
  await Promise.all(workers.map((w) => w.close()));
  await closeQueues();
  redis.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
