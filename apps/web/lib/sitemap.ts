import "server-only";
import { cacheLife } from "next/cache";
import { prisma } from "@truyen/db";
import { READABLE_STORY } from "./data";

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
      ...READABLE_STORY,
      id: { gt: index * STORIES_PER_SITEMAP, lte: (index + 1) * STORIES_PER_SITEMAP },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
}

/** Số chương tối đa mỗi file sitemap chương */
export const CHAPTERS_PER_SITEMAP = 40_000;

/** Số file sitemap chương, chia theo khoảng id (tăng dần theo kho truyện nên tính lại mỗi giờ). */
export async function chapterSitemapCount() {
  "use cache";
  cacheLife("hours");
  const { _max } = await prisma.chapter.aggregate({ _max: { id: true } });
  return Math.max(1, Math.ceil((_max.id ?? 0) / CHAPTERS_PER_SITEMAP));
}

/** Chương đọc được (đã có nội dung hoặc còn nguồn đang bật) của truyện đang hiển thị. */
export async function chapterSitemapEntries(index: number) {
  "use cache";
  cacheLife("hours");
  return prisma.chapter.findMany({
    where: {
      id: { gt: index * CHAPTERS_PER_SITEMAP, lte: (index + 1) * CHAPTERS_PER_SITEMAP },
      story: READABLE_STORY,
      OR: [{ content: { isNot: null } }, { sources: { some: { storySource: { source: { enabled: true } } } } }],
    },
    select: { number: true, createdAt: true, story: { select: { slug: true } } },
    orderBy: { id: "asc" },
  });
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function urlsetXml(entries: { loc: string; lastmod?: Date }[]) {
  const urls = entries
    .map((e) => `<url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function sitemapIndexXml(locs: string[]) {
  const items = locs.map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

/** Cache ở CDN một giờ, phục vụ bản cũ trong lúc làm mới. */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};
