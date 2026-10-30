import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma, type Prisma, type StoryStatus, type StoryType } from "@truyen/db";
import { getAdapter } from "@truyen/crawler";
import { toSearchText } from "@truyen/shared";
import { ensureChapterContent } from "./chapter-content";
import { stripHtml } from "./format";
import { proxiedImage } from "./image-proxy";

export const PAGE_SIZE = 24;
export const CHAPTER_PAGE_SIZE = 100;

export const SORTS = {
  updated: "Mới cập nhật",
  views: "Xem nhiều",
  new: "Truyện mới",
  chapters: "Nhiều chương",
} as const;
export type SortKey = keyof typeof SORTS;

const storyCardSelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  status: true,
  coverUrl: true,
  chapterCount: true,
  latestChapterAt: true,
  viewCount: true,
  chapters: { orderBy: { number: "desc" }, take: 1, select: { number: true } },
} satisfies Prisma.StorySelect;

type StoryCardRow = Prisma.StoryGetPayload<{ select: typeof storyCardSelect }>;

function toCard({ chapters, coverUrl, ...story }: StoryCardRow) {
  return { ...story, cover: proxiedImage(coverUrl), latestChapter: chapters[0]?.number ?? null };
}
export type StoryCard = ReturnType<typeof toCard>;

const ORDER_BY: Record<SortKey, Prisma.StoryOrderByWithRelationInput[]> = {
  updated: [{ latestChapterAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  views: [{ viewCount: "desc" }, { id: "desc" }],
  new: [{ createdAt: "desc" }],
  chapters: [{ chapterCount: "desc" }, { id: "desc" }],
};

export interface ListParams {
  type?: StoryType;
  genre?: string;
  status?: StoryStatus;
  sort?: SortKey;
  q?: string;
  page?: number;
  /** Số truyện mỗi trang, mặc định PAGE_SIZE */
  limit?: number;
}

/**
 * Truyện hiển thị công khai: không bị ẩn, có chương, và còn ít nhất một nguồn đang bật có chương
 * (nguồn bị tắt — vd chặn IP máy chủ — thì chương chưa tải không đọc được nữa).
 */
export const READABLE_STORY = {
  hidden: false,
  chapterCount: { gt: 0 },
  sources: { some: { source: { enabled: true }, chapterCount: { gt: 0 } } },
} satisfies Prisma.StoryWhereInput;

export async function listStories(params: ListParams) {
  "use cache";
  cacheLife("minutes");
  cacheTag("stories");

  const page = Math.max(1, params.page ?? 1);
  const limit = params.limit ?? PAGE_SIZE;
  const q = params.q ? toSearchText(params.q) : "";
  const where: Prisma.StoryWhereInput = {
    ...READABLE_STORY,
    type: params.type,
    status: params.status,
    ...(params.genre && { genres: { some: { genre: { slug: params.genre } } } }),
    ...(q && { searchText: { contains: q } }),
  };

  const [rows, total] = await Promise.all([
    prisma.story.findMany({
      where,
      orderBy: ORDER_BY[params.sort ?? (q ? "views" : "updated")],
      skip: (page - 1) * limit,
      take: limit,
      select: storyCardSelect,
    }),
    prisma.story.count({ where }),
  ]);
  return { items: rows.map(toCard), total, page, pageCount: Math.ceil(total / limit) };
}

/** Truyện nổi bật cho banner trang chủ: xem nhiều, có ảnh bìa và giới thiệu. */
export async function getFeatured(limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag("stories");
  const rows = await prisma.story.findMany({
    where: { ...READABLE_STORY, coverUrl: { not: null }, description: { not: null } },
    orderBy: [{ viewCount: "desc" }, { latestChapterAt: { sort: "desc", nulls: "last" } }],
    take: limit,
    select: {
      ...storyCardSelect,
      description: true,
      genres: { take: 3, select: { genre: { select: { name: true, slug: true } } } },
    },
  });
  return rows.map(({ description, genres, ...row }) => ({
    ...toCard(row),
    excerpt: stripHtml(description).slice(0, 240),
    genres: genres.map((g) => g.genre),
  }));
}
export type FeaturedStory = Awaited<ReturnType<typeof getFeatured>>[number];

export async function getGenres() {
  "use cache";
  cacheLife("hours");
  cacheTag("genres");
  return prisma.genre.findMany({
    where: { stories: { some: { story: READABLE_STORY } } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });
}

export async function getGenre(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("genres");
  return prisma.genre.findUnique({ where: { slug }, select: { name: true, slug: true } });
}

export async function getStory(slug: string) {
  "use cache";
  cacheTag(`story-${slug}`);

  const story = await prisma.story.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true, slug: true } },
      genres: { select: { genre: { select: { name: true, slug: true } } } },
      sources: {
        select: { path: true, chapterCount: true, source: { select: { key: true, name: true, baseUrl: true, enabled: true } } },
      },
    },
  });
  if (!story || story.hidden) {
    cacheLife("minutes");
    return null;
  }
  cacheLife("minutes");

  const [first, last] = await Promise.all([
    prisma.chapter.findFirst({ where: { storyId: story.id }, orderBy: { number: "asc" }, select: { number: true } }),
    prisma.chapter.findFirst({ where: { storyId: story.id }, orderBy: { number: "desc" }, select: { number: true, title: true } }),
  ]);

  const { coverUrl, genres, sources, ...rest } = story;
  return {
    ...rest,
    cover: proxiedImage(coverUrl),
    genres: genres.map((g) => g.genre),
    sources: sources.map((s) => ({ name: s.source.name, url: sourceWebUrl(s.source, s.path) })),
    /** Còn nguồn đang bật — không thì chỉ đọc được các chương đã tải trước đó */
    readable: sources.some((s) => s.source.enabled && s.chapterCount > 0),
    firstChapter: first?.number ?? null,
    lastChapter: last ?? null,
    rating: story.ratingCount ? story.ratingSum / story.ratingCount : null,
  };
}
export type StoryDetail = NonNullable<Awaited<ReturnType<typeof getStory>>>;

export async function getChapterPage(storyId: number, page: number, order: "asc" | "desc") {
  "use cache";
  cacheLife("minutes");
  cacheTag(`chapters-${storyId}`);
  const [chapters, total] = await Promise.all([
    prisma.chapter.findMany({
      where: { storyId },
      orderBy: { number: order },
      skip: (Math.max(1, page) - 1) * CHAPTER_PAGE_SIZE,
      take: CHAPTER_PAGE_SIZE,
      select: { number: true, title: true },
    }),
    prisma.chapter.count({ where: { storyId } }),
  ]);
  return { chapters, total, pageCount: Math.ceil(total / CHAPTER_PAGE_SIZE) };
}

/** Thông tin một chương + chương trước/sau. */
export async function getChapter(storyId: number, number: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`chapters-${storyId}`);
  const [chapter, prev, next] = await Promise.all([
    prisma.chapter.findUnique({
      where: { storyId_number: { storyId, number } },
      select: { id: true, number: true, title: true },
    }),
    prisma.chapter.findFirst({
      where: { storyId, number: { lt: number } },
      orderBy: { number: "desc" },
      select: { number: true },
    }),
    prisma.chapter.findFirst({
      where: { storyId, number: { gt: number } },
      orderBy: { number: "asc" },
      select: { number: true },
    }),
  ]);
  if (!chapter) return null;
  return { ...chapter, prev: prev?.number ?? null, next: next?.number ?? null };
}

/** Danh sách số chương (cho ô chọn chương trong trình đọc). */
export async function getChapterNumbers(storyId: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`chapters-${storyId}`);
  return prisma.chapter.findMany({
    where: { storyId },
    orderBy: { number: "asc" },
    select: { number: true, title: true },
  });
}

/** Vị trí ảnh quảng cáo của nguồn trong chương (worker nhận diện sau khi tải nội dung). */
export async function getChapterAdIndexes(chapterId: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`ads-${chapterId}`);
  const content = await prisma.chapterContent.findUnique({ where: { chapterId }, select: { adIndexes: true } });
  return content?.adIndexes ?? [];
}

/** Quảng cáo của site đang bật — hiển thị thay ảnh quảng cáo của nguồn. */
export async function getHouseAds() {
  "use cache";
  cacheLife("minutes");
  cacheTag("house-ads");
  return prisma.houseAd.findMany({
    where: { enabled: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true, imageUrl: true, linkUrl: true },
  });
}
export type HouseAd = Awaited<ReturnType<typeof getHouseAds>>[number];

/** Ghi công nguồn + nhóm dịch của nội dung đang hiển thị (MangaDex bắt buộc) */
export interface ChapterCredit {
  source: string;
  url: string | null;
  group: string | null;
}

export type ChapterBody = ({ kind: "text"; html: string } | { kind: "images"; urls: string[] }) & {
  credit: ChapterCredit | null;
};

/** Trang công khai của truyện/chương trên nguồn; nguồn chưa có adapter thì không có link. */
function sourceWebUrl(source: { key: string; baseUrl: string }, path: string) {
  try {
    return getAdapter(source).webUrl(path);
  } catch {
    return null;
  }
}

async function chapterCredit(chapterId: number, sourceId: number): Promise<ChapterCredit | null> {
  const link = await prisma.chapterSource.findFirst({
    where: { chapterId, storySource: { sourceId } },
    select: { path: true, credit: true, storySource: { select: { source: { select: { key: true, name: true, baseUrl: true } } } } },
  });
  if (!link) return null;
  const { source } = link.storySource;
  return { source: source.name, url: sourceWebUrl(source, link.path), group: link.credit };
}

/** Chương đọc được không: đã có nội dung, hoặc còn nguồn đang bật để tải. */
export async function isChapterReadable(chapterId: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`content-${chapterId}`, "sources");
  const count = await prisma.chapter.count({
    where: {
      id: chapterId,
      OR: [{ content: { isNot: null } }, { sources: { some: { storySource: { source: { enabled: true } } } } }],
    },
  });
  return count > 0;
}

/** Nội dung chương: lấy từ DB, chưa có thì tải từ nguồn ngay lúc đọc. Nội dung không đổi nên cache lâu. */
export async function getChapterBody(chapterId: number): Promise<ChapterBody> {
  "use cache";
  cacheLife("max");
  cacheTag(`content-${chapterId}`);
  const content = await ensureChapterContent(chapterId);
  const credit = await chapterCredit(chapterId, content.sourceId);
  if (content.text) return { kind: "text", html: content.text, credit };
  const urls = Array.isArray(content.images) ? (content.images as string[]) : [];
  return { kind: "images", urls: urls.map((u) => proxiedImage(u)), credit };
}
