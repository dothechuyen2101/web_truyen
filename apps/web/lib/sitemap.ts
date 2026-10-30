import "server-only";
import { cacheLife } from "next/cache";
import { prisma } from "@truyen/db";

/** Số truyện tối đa mỗi file sitemap (Google giới hạn 50.000 URL) */
export const STORIES_PER_SITEMAP = 40_000;

/** Số file sitemap truyện, chia theo khoảng id. */
export async function storySitemapCount() {
  "use cache";
  cacheLife("hours");
  const { _max } = await prisma.story.aggregate({ _max: { id: true } });
  return Math.max(1, Math.ceil((_max.id ?? 0) / STORIES_PER_SITEMAP));
}

export async function storySitemapEntries(index: number) {
  "use cache";
  cacheLife("hours");
  return prisma.story.findMany({
    where: {
      hidden: false,
      chapterCount: { gt: 0 },
      id: { gt: index * STORIES_PER_SITEMAP, lte: (index + 1) * STORIES_PER_SITEMAP },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
}
