import type { NextRequest } from "next/server";
import { listComments } from "@/lib/comments";

/** Bình luận của truyện (hoặc của một chương với ?chapterId=), phân trang bằng ?cursor= */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/stories/[id]/comments">) {
  const storyId = Number((await params).id);
  if (!Number.isInteger(storyId)) return Response.json({ error: "storyId không hợp lệ" }, { status: 400 });
  const sp = request.nextUrl.searchParams;
  const chapterId = Number(sp.get("chapterId")) || undefined;
  const cursor = Number(sp.get("cursor")) || undefined;
  return Response.json(await listComments(storyId, { chapterId, cursor }), {
    headers: { "Cache-Control": "no-store" },
  });
}
