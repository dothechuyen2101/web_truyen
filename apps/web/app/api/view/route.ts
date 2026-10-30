import { after, type NextRequest } from "next/server";
import { prisma } from "@truyen/db";
import { syncTracked } from "@truyen/crawler";
import { getSession } from "@/lib/auth";
import { prefetchNextChapters } from "@/lib/chapter-content";

// Việc nền sau khi trả lời (tải trước chương, nhận diện quảng cáo, đồng bộ lại truyện) cần thêm thời gian.
export const maxDuration = 60;

/** Truyện đang được đọc mà lâu hơn ngần này chưa đồng bộ thì đồng bộ lại để có chương mới */
const RESYNC_AFTER_MS = 6 * 3600 * 1000;
/** Không thử đồng bộ lại một truyện quá thường xuyên (kể cả khi lần trước lỗi) */
const RESYNC_ATTEMPT_GAP_MS = 30 * 60 * 1000;

/** Truyện lâu chưa đồng bộ: đồng bộ lại từ nguồn ưu tiên cao nhất. */
async function resyncIfStale(storyId: number) {
  const link = await prisma.storySource.findFirst({
    where: { storyId, source: { enabled: true } },
    orderBy: [{ source: { priority: "desc" } }, { priority: "desc" }],
    include: { source: true },
  });
  if (!link || (link.lastSyncedAt && Date.now() - link.lastSyncedAt.getTime() < RESYNC_AFTER_MS)) return;
  const recentAttempt = await prisma.crawlRun.findFirst({
    where: {
      job: "syncStory",
      sourceId: link.sourceId,
      target: link.path,
      startedAt: { gt: new Date(Date.now() - RESYNC_ATTEMPT_GAP_MS) },
    },
    select: { id: true },
  });
  if (!recentAttempt) await syncTracked(link.source, link.path);
}

/** Chương truyện tranh chưa được kiểm tra ảnh quảng cáo của nguồn (chỉ khi đã có mẫu). */
async function checkAdsIfNeeded(chapterId: number) {
  const content = await prisma.chapterContent.findUnique({
    where: { chapterId },
    select: { adCheckedAt: true, text: true },
  });
  if (!content || content.text !== null || content.adCheckedAt || !(await prisma.adFingerprint.count())) return;
  // sharp (native) chỉ nạp khi thật sự cần.
  const { detectChapterAds } = await import("@truyen/crawler/ads");
  await detectChapterAds(chapterId);
}

/**
 * Gọi từ trình duyệt khi người đọc mở chương. `countView` do trình duyệt quyết định
 * (mỗi truyện tính một lượt trong 30 phút). Việc nặng chạy sau khi đã trả lời.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    storyId?: unknown;
    chapterId?: unknown;
    chapterNumber?: unknown;
    countView?: unknown;
  } | null;
  const storyId = Number(body?.storyId);
  const chapterId = Number(body?.chapterId);
  const chapterNumber = Number(body?.chapterNumber);
  if (!Number.isInteger(storyId) || !Number.isInteger(chapterId)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (body?.countView === true) {
    await prisma.story.updateMany({ where: { id: storyId }, data: { viewCount: { increment: 1 } } });
  }

  const session = await getSession();
  if (session && Number.isFinite(chapterNumber)) {
    await prisma.readingHistory
      .upsert({
        where: { userId_storyId: { userId: session.user.id, storyId } },
        create: { userId: session.user.id, storyId, chapterNumber },
        update: { chapterNumber },
      })
      .catch((e) => console.error("Không lưu được lịch sử đọc:", e));
  }

  after(async () => {
    const tasks = [checkAdsIfNeeded(chapterId), prefetchNextChapters(chapterId), resyncIfStale(storyId)];
    for (const result of await Promise.allSettled(tasks)) {
      if (result.status === "rejected") console.error("Việc nền khi đọc chương lỗi:", result.reason);
    }
  });
  return Response.json({ ok: true });
}
