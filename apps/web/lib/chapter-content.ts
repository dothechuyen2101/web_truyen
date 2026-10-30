import "server-only";
import { prisma } from "@truyen/db";
import { fetchChapterContent } from "@truyen/crawler";

/** Thời gian tối đa người đọc phải chờ khi chương chưa có trong DB */
const FETCH_TIMEOUT_MS = 10_000;
/** Số chương kế tiếp được tải trước khi có người đọc */
const PREFETCH_AHEAD = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Trả về nội dung chương, lấy từ nguồn nếu DB chưa có. Quá thời gian chờ thì báo lỗi cho người
 * đọc nhưng việc tải vẫn chạy tiếp và lưu DB cho lần đọc sau. Hai người mở cùng lúc có thể tải
 * trùng một lần — vô hại vì ghi bằng upsert.
 */
export async function ensureChapterContent(chapterId: number) {
  const existing = await prisma.chapterContent.findUnique({ where: { chapterId } });
  if (existing) return existing;
  return Promise.race([
    fetchChapterContent(chapterId),
    sleep(FETCH_TIMEOUT_MS).then(() => {
      throw new Error("Nguồn phản hồi quá chậm, vui lòng thử lại sau ít phút");
    }),
  ]);
}

/** Tải trước các chương kế tiếp chưa có nội dung (gọi trong after(), sau khi đã trả trang). */
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
  for (const c of next) await fetchChapterContent(c.id).catch(() => {});
}
