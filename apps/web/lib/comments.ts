import "server-only";
import { prisma, type Prisma } from "@truyen/db";

export const COMMENTS_PAGE_SIZE = 20;
const REPLIES_LIMIT = 20;

const userSelect = { select: { id: true, name: true, image: true, role: true } } as const;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: userSelect,
  chapter: { select: { number: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

function toDto({ chapter, ...c }: CommentRow) {
  return { ...c, createdAt: c.createdAt.toISOString(), chapterNumber: chapter?.number ?? null };
}

export type CommentDto = ReturnType<typeof toDto> & { replies: ReturnType<typeof toDto>[] };

/** Bình luận gốc mới nhất (kèm trả lời), phân trang theo id giảm dần. */
export async function listComments(storyId: number, { chapterId, cursor }: { chapterId?: number; cursor?: number }) {
  const rows = await prisma.comment.findMany({
    where: {
      storyId,
      parentId: null,
      hidden: false,
      ...(chapterId && { chapterId }),
      ...(cursor && { id: { lt: cursor } }),
    },
    orderBy: { id: "desc" },
    take: COMMENTS_PAGE_SIZE + 1,
    select: {
      ...commentSelect,
      replies: {
        where: { hidden: false },
        orderBy: { id: "asc" },
        take: REPLIES_LIMIT,
        select: commentSelect,
      },
    },
  });
  const page = rows.slice(0, COMMENTS_PAGE_SIZE);
  return {
    comments: page.map(({ replies, ...c }): CommentDto => ({ ...toDto(c), replies: replies.map(toDto) })),
    nextCursor: rows.length > COMMENTS_PAGE_SIZE ? page.at(-1)!.id : null,
  };
}

export async function countComments(storyId: number) {
  return prisma.comment.count({ where: { storyId, hidden: false } });
}
