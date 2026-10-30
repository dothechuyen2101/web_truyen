import "server-only";
import { prisma } from "@truyen/db";
import { fetchChapterContent } from "@truyen/crawler";
import { enqueue } from "@truyen/crawler/queue";
import { redis } from "./redis";

/** Thời gian tối đa người đọc phải chờ khi chương chưa có trong DB */
const FETCH_TIMEOUT_MS = 10_000;
const LOCK_TTL_MS = 30_000;
/** Số chương kế tiếp được tải trước khi có người đọc */
const PREFETCH_AHEAD = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error("Nguồn phản hồi quá chậm, vui lòng thử lại sau ít phút");
    }),
  ]);
}

/**
 * Trả về nội dung chương, lấy từ nguồn nếu DB chưa có.
 * Redis lock đảm bảo nhiều người mở cùng một chương chỉ tạo một request tới nguồn.
 */
export async function ensureChapterContent(chapterId: number) {
  const existing = await prisma.chapterContent.findUnique({ where: { chapterId } });
  if (existing) return existing;

  const lockKey = `lock:chapter:${chapterId}`;
  if (await redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX")) {
    // Nếu quá thời gian chờ, việc tải vẫn chạy tiếp và lưu DB cho lần đọc sau.
    const fetching = fetchChapterContent(chapterId)
      .then((content) => {
        // Truyện tranh: nhận diện ảnh quảng cáo của nguồn ở nền.
        if (content.images) enqueue.ads(chapterId).catch(() => {});
        return content;
      })
      .finally(() => redis.del(lockKey));
    return withTimeout(fetching, FETCH_TIMEOUT_MS);
  }

  // Một request khác đang tải chương này — chờ kết quả được ghi vào DB.
  for (let waited = 0; waited < FETCH_TIMEOUT_MS; waited += 400) {
    await sleep(400);
    const content = await prisma.chapterContent.findUnique({ where: { chapterId } });
    if (content) return content;
  }
  throw new Error("Nguồn phản hồi quá chậm, vui lòng thử lại sau ít phút");
}

/** Xếp job tải trước các chương kế tiếp chưa có nội dung. */
export async function prefetchNextChapters(chapterId: number) {
  const current = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { storyId: true, number: true },
  });
  if (!current) return;
  const next = await prisma.chapter.findMany({
    where: { storyId: current.storyId, number: { gt: current.number }, content: null },
    orderBy: { number: "asc" },
    take: PREFETCH_AHEAD,
    select: { id: true },
  });
  await Promise.all(next.map((c) => enqueue.content(c.id)));
}
