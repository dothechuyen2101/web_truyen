import { prisma } from "@truyen/db";
import { getSession } from "@/lib/auth";

/** Trạng thái riêng của người đăng nhập với một truyện: đang theo dõi, điểm đã chấm. */
export async function GET(_request: Request, { params }: RouteContext<"/api/me/stories/[id]">) {
  const storyId = Number((await params).id);
  const session = await getSession();
  if (!session || !Number.isInteger(storyId)) {
    return Response.json({ following: false, rating: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const key = { userId_storyId: { userId: session.user.id, storyId } };
  const [follow, rating] = await Promise.all([
    prisma.follow.findUnique({ where: key, select: { storyId: true } }),
    prisma.rating.findUnique({ where: key, select: { score: true } }),
  ]);
  return Response.json(
    { following: Boolean(follow), rating: rating?.score ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
