"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { prisma } from "@truyen/db";
import { fingerprintImage } from "@truyen/crawler/ads";
import { mergeStories, splitSource } from "@truyen/crawler/merge";
import { PRIORITY, enqueue, getQueues } from "@truyen/crawler/queue";
import { actionError, assertAdmin, type ActionState } from "@/lib/admin";
import { auth } from "@/lib/auth";

const num = (fd: FormData, key: string) => {
  const value = Number(fd.get(key));
  if (!Number.isFinite(value)) throw new Error(`Giá trị "${key}" không hợp lệ`);
  return value;
};
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function httpsUrl(value: string, field: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url;
  } catch {
    throw new Error(`${field} phải là URL hợp lệ`);
  }
}

/** Chạy một thao tác admin, trả kết quả cho ActionForm và làm mới trang. */
async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    await assertAdmin();
    const message = await fn();
    refresh();
    return { ok: true, message };
  } catch (error) {
    return actionError(error);
  }
}

function invalidateStory(slug: string) {
  updateTag(`story-${slug}`);
  updateTag("stories");
}

// ---------- Nguồn ----------

export async function updateSource(_: ActionState, fd: FormData) {
  return run(async () => {
    const baseUrl = httpsUrl(str(fd, "baseUrl"), "Domain").origin;
    await prisma.source.update({
      where: { id: num(fd, "id") },
      data: {
        baseUrl,
        priority: num(fd, "priority"),
        rateLimitMs: Math.max(100, num(fd, "rateLimitMs")),
        enabled: fd.get("enabled") === "on",
      },
    });
    updateTag("sources");
    return "Đã lưu cấu hình nguồn";
  });
}

export async function crawlSourceNow(_: ActionState, fd: FormData) {
  return run(async () => {
    await enqueue.discovery({ sourceId: num(fd, "id"), pages: 2 });
    return "Đã xếp lịch quét trang mới cập nhật";
  });
}

export async function startBackfill(_: ActionState, fd: FormData) {
  return run(async () => {
    const fromPage = Math.max(1, Number(fd.get("fromPage")) || 1);
    await enqueue.discovery({ sourceId: num(fd, "id"), backfill: true, fromPage });
    return `Đã bắt đầu backfill từ trang ${fromPage}`;
  });
}

export async function stopBackfill(_: ActionState, fd: FormData) {
  return run(async () => {
    const sourceId = num(fd, "id");
    const { discovery } = getQueues();
    const jobs = await discovery.getJobs(["waiting", "delayed", "prioritized"]);
    const targets = jobs.filter((j) => j.data.backfill && j.data.sourceId === sourceId);
    await Promise.all(targets.map((j) => j.remove()));
    return targets.length ? `Đã huỷ ${targets.length} đoạn backfill đang chờ` : "Không có backfill nào đang chờ";
  });
}

export async function syncStoryUrl(_: ActionState, fd: FormData) {
  return run(async () => {
    const source = await prisma.source.findUniqueOrThrow({ where: { id: num(fd, "id") } });
    const url = new URL(str(fd, "url"), source.baseUrl);
    await enqueue.sync({ sourceId: source.id, path: url.pathname + url.search }, PRIORITY.manual);
    return `Đã xếp lịch đồng bộ ${url.pathname}`;
  });
}

// ---------- Truyện ----------

export async function setStoryHidden(_: ActionState, fd: FormData) {
  return run(async () => {
    const hidden = fd.get("hidden") === "1";
    const story = await prisma.story.update({ where: { id: num(fd, "id") }, data: { hidden } });
    invalidateStory(story.slug);
    return hidden ? "Đã ẩn truyện" : "Đã hiện truyện";
  });
}

export async function resyncStory(_: ActionState, fd: FormData) {
  return run(async () => {
    const links = await prisma.storySource.findMany({ where: { storyId: num(fd, "id") } });
    for (const l of links) await enqueue.sync({ sourceId: l.sourceId, path: l.path }, PRIORITY.manual);
    return `Đã xếp lịch đồng bộ lại ${links.length} nguồn`;
  });
}

export async function mergeIntoStory(_: ActionState, fd: FormData) {
  return run(async () => {
    const intoId = num(fd, "id");
    const ref = str(fd, "from");
    const from = await prisma.story.findFirst({
      where: /^\d+$/.test(ref) ? { id: Number(ref) } : { slug: ref.replace(/^.*\/truyen\//, "").replace(/\/.*$/, "") },
      select: { id: true },
    });
    if (!from) throw new Error("Không tìm thấy truyện cần gộp");
    const { intoSlug, fromSlug } = await mergeStories(intoId, from.id);
    invalidateStory(intoSlug);
    invalidateStory(fromSlug);
    updateTag(`chapters-${intoId}`);
    return `Đã gộp “${fromSlug}” vào truyện này`;
  });
}

export async function splitStorySource(_: ActionState, fd: FormData) {
  return run(async () => {
    const result = await splitSource(num(fd, "storySourceId"));
    await enqueue.sync({ sourceId: result.sourceId, path: result.path }, PRIORITY.manual);
    invalidateStory(result.oldSlug);
    updateTag(`chapters-${num(fd, "id")}`);
    return `Đã tách thành truyện mới #${result.newStoryId}, đang đồng bộ lại`;
  });
}

export async function deleteStory(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const story = await prisma.story.delete({ where: { id: num(fd, "id") } });
    invalidateStory(story.slug);
  } catch (error) {
    return actionError(error);
  }
  redirect("/admin/truyen");
}

// ---------- Bình luận ----------

export async function setCommentHidden(_: ActionState, fd: FormData) {
  return run(async () => {
    const hidden = fd.get("hidden") === "1";
    await prisma.comment.update({ where: { id: num(fd, "id") }, data: { hidden } });
    return hidden ? "Đã ẩn bình luận" : "Đã hiện bình luận";
  });
}

// ---------- Người dùng ----------

export async function setUserRole(_: ActionState, fd: FormData) {
  return run(async () => {
    const admin = await assertAdmin();
    const userId = str(fd, "userId");
    const role = str(fd, "role") === "admin" ? "admin" : "user";
    if (userId === admin.id && role !== "admin") throw new Error("Không thể tự bỏ quyền admin của mình");
    await auth.api.setRole({ body: { userId, role }, headers: await headers() });
    return role === "admin" ? "Đã cấp quyền admin" : "Đã chuyển về người dùng thường";
  });
}

export async function setUserBanned(_: ActionState, fd: FormData) {
  return run(async () => {
    const admin = await assertAdmin();
    const userId = str(fd, "userId");
    if (userId === admin.id) throw new Error("Không thể tự khoá tài khoản của mình");
    if (fd.get("banned") === "1") {
      await auth.api.banUser({
        body: { userId, banReason: str(fd, "reason") || "Vi phạm quy định" },
        headers: await headers(),
      });
      return "Đã khoá tài khoản (các phiên đăng nhập bị thu hồi)";
    }
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
    return "Đã mở khoá tài khoản";
  });
}

// ---------- Yêu cầu gỡ nội dung ----------

export async function resolveTakedown(_: ActionState, fd: FormData) {
  return run(async () => {
    const request = await prisma.takedownRequest.findUniqueOrThrow({ where: { id: num(fd, "id") } });
    if (fd.get("decision") === "reject") {
      await prisma.takedownRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", resolvedAt: new Date() },
      });
      return "Đã từ chối yêu cầu";
    }
    // Ẩn các truyện có trong danh sách URL (dạng .../truyen/<slug>...).
    const slugs = [...request.urls.matchAll(/\/truyen\/([a-z0-9-]+)/g)].map((m) => m[1]!);
    const stories = await prisma.story.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    await prisma.story.updateMany({ where: { id: { in: stories.map((s) => s.id) } }, data: { hidden: true } });
    stories.forEach((s) => invalidateStory(s.slug));
    await prisma.takedownRequest.update({
      where: { id: request.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    return `Đã xử lý, ẩn ${stories.length} truyện`;
  });
}

// ---------- Quảng cáo ----------

export async function addHouseAd(_: ActionState, fd: FormData) {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Nhập tên quảng cáo");
    const linkUrl = str(fd, "linkUrl");
    await prisma.houseAd.create({
      data: {
        name,
        imageUrl: httpsUrl(str(fd, "imageUrl"), "Ảnh quảng cáo").toString(),
        linkUrl: linkUrl ? httpsUrl(linkUrl, "Link").toString() : null,
      },
    });
    updateTag("house-ads");
    return "Đã thêm quảng cáo";
  });
}

export async function updateHouseAd(_: ActionState, fd: FormData) {
  return run(async () => {
    const id = num(fd, "id");
    if (fd.get("op") === "delete") {
      await prisma.houseAd.delete({ where: { id } });
    } else {
      await prisma.houseAd.update({ where: { id }, data: { enabled: fd.get("enabled") === "1" } });
    }
    updateTag("house-ads");
    return "Đã cập nhật";
  });
}

export async function markAdImage(_: ActionState, fd: FormData) {
  return run(async () => {
    const imageUrl = httpsUrl(str(fd, "imageUrl"), "Ảnh").toString();
    const hash = await fingerprintImage(imageUrl);
    await prisma.adFingerprint.upsert({
      where: { hash },
      create: { hash, sampleUrl: imageUrl, label: str(fd, "label") || null },
      update: {},
    });
    const chapterId = Number(fd.get("chapterId"));
    if (Number.isInteger(chapterId)) await enqueue.ads(chapterId, PRIORITY.manual);
    return "Đã lưu dấu vân tay ảnh quảng cáo";
  });
}

export async function deleteFingerprint(_: ActionState, fd: FormData) {
  return run(async () => {
    await prisma.adFingerprint.delete({ where: { id: num(fd, "id") } });
    return "Đã xoá dấu vân tay";
  });
}

export async function rescanAds(_: ActionState, fd: FormData) {
  return run(async () => {
    const days = Math.min(365, Math.max(1, Number(fd.get("days")) || 30));
    const chapters = await prisma.chapterContent.findMany({
      where: { fetchedAt: { gte: new Date(Date.now() - days * 24 * 3600 * 1000) }, text: null },
      orderBy: { fetchedAt: "desc" },
      take: 5000,
      select: { chapterId: true },
    });
    for (const c of chapters) await enqueue.ads(c.chapterId, PRIORITY.backfill);
    return `Đã xếp lịch quét lại ${chapters.length} chương truyện tranh`;
  });
}
