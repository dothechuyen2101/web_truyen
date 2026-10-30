import { prisma } from "@truyen/db";
import { getSession } from "@/lib/auth";
import { proxiedImage } from "@/lib/image-proxy";

const LIMIT = 100;

const storySelect = {
  slug: true,
  title: true,
  type: true,
  coverUrl: true,
  latestChapterAt: true,
  chapters: { orderBy: { number: "desc" as const }, take: 1, select: { number: true } },
};

/** Tủ truyện của người đăng nhập: truyện đang theo dõi + lịch sử đọc trên server. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const userId = session.user.id;

  const [follows, history] = await Promise.all([
    prisma.follow.findMany({
      where: { userId, story: { hidden: false } },
      orderBy: { story: { latestChapterAt: { sort: "desc", nulls: "last" } } },
      take: LIMIT,
      select: { story: { select: storySelect } },
    }),
    prisma.readingHistory.findMany({
      where: { userId, story: { hidden: false } },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      select: { chapterNumber: true, updatedAt: true, story: { select: storySelect } },
    }),
  ]);

  const card = ({ chapters, coverUrl, ...s }: (typeof follows)[number]["story"]) => ({
    ...s,
    cover: proxiedImage(coverUrl),
    latestChapter: chapters[0]?.number ?? null,
  });

  return Response.json(
    {
      follows: follows.map((f) => card(f.story)),
      history: history.map((h) => ({ ...card(h.story), chapter: h.chapterNumber, at: h.updatedAt.getTime() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
