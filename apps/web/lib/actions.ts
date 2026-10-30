"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { prisma } from "@truyen/db";
import { isAdmin, requireUser } from "./auth";
import { allow } from "./rate-limit";

const COMMENT_MIN = 2;
const COMMENT_MAX = 2000;
/** Mỗi người tối đa ngần này bình luận mỗi phút */
const COMMENTS_PER_MINUTE = 5;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function storySlug(storyId: number) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { slug: true, hidden: true } });
  if (!story || story.hidden) throw new Error("Không tìm thấy truyện");
  return story.slug;
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại" };
}

export async function toggleFollow(storyId: number): Promise<Result<{ following: boolean }>> {
  try {
    const user = await requireUser();
    const slug = await storySlug(storyId);
    const key = { userId_storyId: { userId: user.id, storyId } };
    const existing = await prisma.follow.findUnique({ where: key });

    await prisma.$transaction(
      existing
        ? [
            prisma.follow.delete({ where: key }),
            prisma.story.update({ where: { id: storyId }, data: { followCount: { decrement: 1 } } }),
          ]
        : [
            prisma.follow.create({ data: { userId: user.id, storyId } }),
            prisma.story.update({ where: { id: storyId }, data: { followCount: { increment: 1 } } }),
          ],
    );
    updateTag(`story-${slug}`);
    return { ok: true, following: !existing };
  } catch (error) {
    return fail(error);
  }
}

export async function rateStory(storyId: number, score: number): Promise<Result<{ rating: number; count: number }>> {
  try {
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Điểm đánh giá không hợp lệ");
    const user = await requireUser();
    const slug = await storySlug(storyId);

    await prisma.rating.upsert({
      where: { userId_storyId: { userId: user.id, storyId } },
      create: { userId: user.id, storyId, score },
      update: { score },
    });
    // Tính lại từ bảng Rating để tổng luôn đúng kể cả khi người dùng đổi điểm.
    const agg = await prisma.rating.aggregate({ where: { storyId }, _sum: { score: true }, _count: true });
    await prisma.story.update({
      where: { id: storyId },
      data: { ratingSum: agg._sum.score ?? 0, ratingCount: agg._count },
    });
    updateTag(`story-${slug}`);
    return { ok: true, rating: (agg._sum.score ?? 0) / Math.max(1, agg._count), count: agg._count };
  } catch (error) {
    return fail(error);
  }
}

export async function postComment(input: {
  storyId: number;
  chapterId?: number;
  parentId?: number;
  content: string;
}): Promise<Result> {
  try {
    const user = await requireUser();
    const content = input.content.trim();
    if (content.length < COMMENT_MIN) throw new Error("Bình luận quá ngắn");
    if (content.length > COMMENT_MAX) throw new Error(`Bình luận tối đa ${COMMENT_MAX} ký tự`);
    if (!(await allow(`comment:${user.id}`, COMMENTS_PER_MINUTE, 60))) {
      throw new Error("Bạn bình luận quá nhanh, hãy đợi một chút");
    }
    await storySlug(input.storyId);

    // Trả lời luôn gắn vào bình luận gốc (chỉ một cấp lồng nhau).
    let parentId: number | undefined;
    if (input.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: input.parentId },
        select: { id: true, parentId: true, storyId: true },
      });
      if (!parent || parent.storyId !== input.storyId) throw new Error("Bình luận gốc không tồn tại");
      parentId = parent.parentId ?? parent.id;
    }

    await prisma.comment.create({
      data: { userId: user.id, storyId: input.storyId, chapterId: input.chapterId, parentId, content },
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Yêu cầu gỡ nội dung từ chủ sở hữu bản quyền (không cần đăng nhập). */
export async function submitTakedown(
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  try {
    const field = (key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);
    const name = field("name", 200);
    const email = field("email", 200);
    const urls = field("urls", 5000);
    const message = field("message", 5000);
    if (!name || !urls || !message) throw new Error("Vui lòng điền đầy đủ thông tin");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");

    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await allow(`takedown:${ip}`, 5, 3600))) throw new Error("Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau");

    await prisma.takedownRequest.create({ data: { name, email, urls, message } });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Người viết hoặc admin được ẩn bình luận. */
export async function deleteComment(commentId: number): Promise<Result> {
  try {
    const user = await requireUser();
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true } });
    if (!comment) throw new Error("Bình luận không tồn tại");
    if (comment.userId !== user.id && !isAdmin(user)) throw new Error("Bạn không có quyền xoá bình luận này");
    await prisma.comment.update({ where: { id: commentId }, data: { hidden: true } });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
