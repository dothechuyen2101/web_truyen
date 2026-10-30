import { prisma, type Prisma } from "@truyen/db";
import { slugify } from "@truyen/shared";

type Tx = Prisma.TransactionClient;

/** Tính lại các cột đếm của truyện từ dữ liệu thật. */
async function recount(tx: Tx, storyId: number) {
  const [chapters, follows, ratings] = await Promise.all([
    tx.chapter.count({ where: { storyId } }),
    tx.follow.count({ where: { storyId } }),
    tx.rating.aggregate({ where: { storyId }, _sum: { score: true }, _count: true }),
  ]);
  await tx.story.update({
    where: { id: storyId },
    data: {
      chapterCount: chapters,
      followCount: follows,
      ratingSum: ratings._sum.score ?? 0,
      ratingCount: ratings._count,
    },
  });
}

/**
 * Gộp truyện `fromId` vào `intoId` (cùng một truyện nhưng hệ thống chưa tự ghép được):
 * chuyển nguồn, chương, nội dung, theo dõi, đánh giá, bình luận, lịch sử đọc rồi xoá truyện cũ.
 */
export async function mergeStories(intoId: number, fromId: number) {
  if (intoId === fromId) throw new Error("Không thể gộp truyện vào chính nó");

  return prisma.$transaction(
    async (tx) => {
      const [into, from] = await Promise.all([
        tx.story.findUniqueOrThrow({ where: { id: intoId } }),
        tx.story.findUniqueOrThrow({ where: { id: fromId } }),
      ]);
      if (into.type !== from.type) throw new Error("Chỉ gộp được hai truyện cùng loại");

      await tx.storySource.updateMany({ where: { storyId: fromId }, data: { storyId: intoId } });

      // Chương trùng số: chuyển nguồn chương (và nội dung nếu bên kia chưa có) sang chương đích.
      const intoChapters = new Map(
        (await tx.chapter.findMany({ where: { storyId: intoId }, select: { id: true, number: true } })).map((c) => [
          c.number,
          c.id,
        ]),
      );
      const fromChapters = await tx.chapter.findMany({
        where: { storyId: fromId },
        select: { id: true, number: true, content: { select: { chapterId: true } } },
      });
      for (const chapter of fromChapters) {
        const targetId = intoChapters.get(chapter.number);
        if (targetId === undefined) {
          await tx.chapter.update({ where: { id: chapter.id }, data: { storyId: intoId } });
          continue;
        }
        await tx.chapterSource.updateMany({ where: { chapterId: chapter.id }, data: { chapterId: targetId } });
        await tx.comment.updateMany({ where: { chapterId: chapter.id }, data: { chapterId: targetId } });
        const targetHasContent = await tx.chapterContent.findUnique({ where: { chapterId: targetId }, select: { chapterId: true } });
        if (chapter.content && !targetHasContent) {
          await tx.chapterContent.update({ where: { chapterId: chapter.id }, data: { chapterId: targetId } });
        }
        await tx.chapter.delete({ where: { id: chapter.id } });
      }

      // Dữ liệu người dùng: bỏ bản trùng (người đã theo dõi/đánh giá cả hai truyện).
      const follows = await tx.follow.findMany({ where: { storyId: fromId } });
      await tx.follow.createMany({ data: follows.map((f) => ({ ...f, storyId: intoId })), skipDuplicates: true });
      const ratings = await tx.rating.findMany({ where: { storyId: fromId } });
      await tx.rating.createMany({ data: ratings.map((r) => ({ ...r, storyId: intoId })), skipDuplicates: true });
      const histories = await tx.readingHistory.findMany({ where: { storyId: fromId } });
      await tx.readingHistory.createMany({
        data: histories.map((h) => ({ ...h, storyId: intoId })),
        skipDuplicates: true,
      });
      await tx.comment.updateMany({ where: { storyId: fromId }, data: { storyId: intoId } });

      await tx.story.update({
        where: { id: intoId },
        data: {
          viewCount: { increment: from.viewCount },
          altTitles: [...new Set([...into.altTitles, ...from.altTitles, from.title].filter((t) => t !== into.title))],
          description: into.description ?? from.description,
          coverUrl: into.coverUrl ?? from.coverUrl,
          authorId: into.authorId ?? from.authorId,
          latestChapterAt:
            into.latestChapterAt && from.latestChapterAt && from.latestChapterAt > into.latestChapterAt
              ? from.latestChapterAt
              : (into.latestChapterAt ?? from.latestChapterAt),
        },
      });
      await tx.story.delete({ where: { id: fromId } });
      await recount(tx, intoId);
      return { intoSlug: into.slug, fromSlug: from.slug };
    },
    { timeout: 60_000 },
  );
}

/**
 * Tách một nguồn bị ghép nhầm ra thành truyện riêng. Truyện mới có matchKey riêng để
 * không bị tự ghép lại; chương của nó sẽ được tạo lại ở lần đồng bộ kế tiếp.
 */
export async function splitSource(storySourceId: number) {
  return prisma.$transaction(
    async (tx) => {
      const link = await tx.storySource.findUniqueOrThrow({
        where: { id: storySourceId },
        include: { story: true, source: true },
      });
      const others = await tx.storySource.count({ where: { storyId: link.storyId, id: { not: link.id } } });
      if (!others) throw new Error("Truyện chỉ có một nguồn, không cần tách");

      const base = `${slugify(link.story.title)}-${link.source.key}`;
      let slug = base;
      for (let i = 2; await tx.story.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

      const story = await tx.story.create({
        data: {
          slug,
          title: link.story.title,
          type: link.story.type,
          matchKey: `${link.story.matchKey} #${link.id}`,
          searchText: link.story.searchText,
        },
      });
      // Bỏ liên kết chương cũ của nguồn này; chương không còn nguồn nào thì xoá.
      await tx.chapterSource.deleteMany({ where: { storySourceId: link.id } });
      await tx.storySource.update({
        where: { id: link.id },
        data: { storyId: story.id, latestChapterNumber: null, chapterCount: 0 },
      });
      await tx.chapter.deleteMany({ where: { storyId: link.storyId, sources: { none: {} } } });
      await recount(tx, link.storyId);
      return { newStoryId: story.id, oldSlug: link.story.slug, sourceId: link.sourceId, path: link.path };
    },
    { timeout: 60_000 },
  );
}
