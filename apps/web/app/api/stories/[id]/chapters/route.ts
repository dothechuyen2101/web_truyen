import { getChapterNumbers } from "@/lib/data";

/** Danh sách số chương của một truyện — dùng cho ô chọn chương trong trình đọc. */
export async function GET(_request: Request, { params }: RouteContext<"/api/stories/[id]/chapters">) {
  const storyId = Number((await params).id);
  if (!Number.isInteger(storyId)) return Response.json([], { status: 400 });
  return Response.json(await getChapterNumbers(storyId), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
