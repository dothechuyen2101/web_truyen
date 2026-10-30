import type { NextRequest } from "next/server";
import { prisma } from "@truyen/db";
import { getSession } from "@/lib/auth";
import { prefetchNextChapters } from "@/lib/chapter-content";
import { redis } from "@/lib/redis";

/** Mỗi IP chỉ được tính một lượt xem cho một truyện trong khoảng này */
const VIEW_DEDUPE_SECONDS = 30 * 60;

/**
 * Gọi từ trình duyệt khi người đọc mở chương: cộng lượt xem (worker ghi xuống DB định kỳ),
 * lưu lịch sử đọc nếu đã đăng nhập, và tải trước các chương kế tiếp.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    storyId?: unknown;
    chapterId?: unknown;
    chapterNumber?: unknown;
  } | null;
  const storyId = Number(body?.storyId);
  const chapterId = Number(body?.chapterId);
  const chapterNumber = Number(body?.chapterNumber);
  if (!Number.isInteger(storyId) || !Number.isInteger(chapterId)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (await redis.set(`viewed:${storyId}:${ip}`, "1", "EX", VIEW_DEDUPE_SECONDS, "NX")) {
    await redis.hincrby("views:pending", String(storyId), 1);
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

  prefetchNextChapters(chapterId).catch((e) => console.error("Không xếp được job tải trước:", e));
  return Response.json({ ok: true });
}
