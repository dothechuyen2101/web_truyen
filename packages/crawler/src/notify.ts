import webpush from "web-push";
import { prisma } from "@truyen/db";
import { chapterPayload } from "./push-payload";
import { withCrawlRun } from "./sync";

export { chapterPayload, type PushPayload } from "./push-payload";

/** Số truyện có chương mới xử lý mỗi lượt (phần còn lại đã quá cũ để báo) */
const MAX_STORIES_PER_RUN = 200;
const SEND_CONCURRENCY = 20;
/** Trình duyệt offline quá lâu thì bỏ thông báo này */
const TTL_SECONDS = 24 * 3600;
/** Lần đầu chạy (chưa có mốc) chỉ báo các chương mới trong khoảng này */
const FIRST_RUN_LOOKBACK_MS = 60 * 60_000;

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;

/**
 * Gửi thông báo đẩy (Web Push) tới người theo dõi các truyện có chương mới kể từ lần gửi thành công trước
 * (mốc lưu trong CrawlRun "notify"). Không cấu hình khoá VAPID thì bỏ qua.
 * Đăng ký đã hết hạn (trình duyệt trả 404/410) bị xoá.
 */
export async function notifyNewChapters({ deadline }: { deadline?: number } = {}) {
  if (!pushConfigured()) return null;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidReady = true;
  }

  const previous = await prisma.crawlRun.findFirst({
    where: { job: "notify", status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const since = previous?.startedAt ?? new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);

  return withCrawlRun("notify", {}, async () => {
    const stories = await prisma.story.findMany({
      where: {
        hidden: false,
        latestChapterAt: { gt: since },
        follows: { some: { user: { pushSubscriptions: { some: {} } } } },
      },
      orderBy: { latestChapterAt: "desc" },
      take: MAX_STORIES_PER_RUN,
      select: {
        slug: true,
        title: true,
        chapters: { orderBy: { number: "desc" }, take: 1, select: { number: true, title: true } },
        follows: {
          select: { user: { select: { pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } } } } },
        },
      },
    });

    const jobs = stories.flatMap((story) => {
      const chapter = story.chapters[0];
      if (!chapter) return [];
      const payload = JSON.stringify(chapterPayload(story, chapter));
      return story.follows.flatMap((f) => f.user.pushSubscriptions.map((sub) => ({ sub, payload })));
    });

    let sent = 0;
    let failed = 0;
    const expired: number[] = [];
    for (let i = 0; i < jobs.length; i += SEND_CONCURRENCY) {
      if (deadline && Date.now() > deadline) break;
      const batch = jobs.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(({ sub, payload }) =>
          webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
            TTL: TTL_SECONDS,
          }),
        ),
      );
      results.forEach((r, j) => {
        if (r.status === "fulfilled") return void sent++;
        const status = (r.reason as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(batch[j]!.sub.id);
        else failed++;
      });
    }
    const removed = expired.length
      ? (await prisma.webPushSubscription.deleteMany({ where: { id: { in: expired } } })).count
      : 0;
    return { stories: stories.length, sent, failed, removed };
  });
}
