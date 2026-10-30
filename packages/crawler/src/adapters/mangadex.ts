import { linesToHtml } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef, StoryStatus } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers } from "./base";

/**
 * MangaDex qua API chính thức (api.mangadex.org) — nguồn truyện tranh không chặn IP máy chủ.
 * Điều kiện sử dụng (https://api.mangadex.org/docs/): ghi công MangaDex và nhóm dịch, gỡ khi nhóm dịch yêu cầu,
 * KHÔNG chạy quảng cáo/dịch vụ thu phí; User-Agent không được giả mạo; ảnh phải đi qua proxy; ~5 request/giây.
 *
 * Path truyện: "/manga/<uuid>", path chương: "/chapter/<uuid>".
 */

const LANGUAGE = "vi";
/** Bỏ nội dung 18+ */
const CONTENT_RATINGS = ["safe", "suggestive"];
/** Không lấy truyện có các tag này dù được xếp loại an toàn/gợi cảm */
const EXCLUDED_TAGS = new Set(["Loli", "Shota", "Incest", "Sexual Violence"]);
const UPLOADS = "https://uploads.mangadex.org";
const LATEST_PAGE_SIZE = 100;
const FEED_PAGE_SIZE = 500;
/** API không cho offset + limit vượt quá mốc này */
const MAX_OFFSET = 10_000;

/** Tag MangaDex → tên thể loại của site (khớp các thể loại sẵn có); tag không có trong bảng thì bỏ qua */
const TAG_TO_GENRE: Record<string, string> = {
  Action: "Action",
  Adventure: "Adventure",
  Comedy: "Comedy",
  Drama: "Drama",
  Fantasy: "Fantasy",
  Horror: "Horror",
  Mystery: "Mystery",
  Psychological: "Psychological",
  Romance: "Romance",
  "Sci-Fi": "Sci-Fi",
  "Slice of Life": "Slice of Life",
  Sports: "Sports",
  Tragedy: "Tragedy",
  Thriller: "Thriller",
  Isekai: "Isekai",
  Mecha: "Mecha",
  Medical: "Medical",
  Superhero: "Superhero",
  "Magical Girls": "Magical Girls",
  Historical: "Cổ Đại",
  Crime: "Trinh Thám",
  Wuxia: "Martial Arts",
  "Martial Arts": "Martial Arts",
  "Boys' Love": "Đam Mỹ",
  "Girls' Love": "Bách Hợp",
  "School Life": "School Life",
  Supernatural: "Supernatural",
  Harem: "Harem",
  "Reverse Harem": "Harem",
  Reincarnation: "Chuyển Sinh",
  "Time Travel": "Xuyên Không",
  Genderswap: "Gender Bender",
  "Video Games": "Game",
  Villainess: "Nữ Phụ",
  "Post-Apocalyptic": "Mạt Thế",
  Zombies: "Mạt Thế",
  Cooking: "Ẩm Thực",
  Oneshot: "One Shot",
  "Full Color": "Truyện Màu",
  "Long Strip": "Webtoon",
};

const ORIGIN_TO_GENRE: Record<string, string> = { ja: "Manga", ko: "Manhwa", zh: "Manhua", "zh-hk": "Manhua" };

// ---------- Kiểu dữ liệu API (chỉ các trường dùng tới) ----------

type LocalizedString = Record<string, string>;

interface Relationship {
  id: string;
  type: string;
  attributes?: { name?: string; fileName?: string } & Partial<MangaAttributes>;
}

interface MangaAttributes {
  title: LocalizedString;
  altTitles: LocalizedString[];
  description: LocalizedString;
  status: string;
  originalLanguage: string;
  tags: { attributes: { name: LocalizedString; group: string } }[];
}

interface MangaData {
  id: string;
  attributes: MangaAttributes;
  relationships: Relationship[];
}

interface ChapterData {
  id: string;
  attributes: {
    chapter: string | null;
    title: string | null;
    isUnavailable?: boolean;
    externalUrl: string | null;
    pages: number;
    readableAt: string;
  };
  relationships: Relationship[];
}

interface ListResponse<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
}

interface AtHomeResponse {
  baseUrl: string;
  chapter: { hash: string; data: string[]; dataSaver: string[] };
}

// ---------- Parse thuần (test được bằng fixture) ----------

function tagNames(manga: Pick<MangaAttributes, "tags">) {
  return manga.tags.map((t) => t.attributes.name.en ?? Object.values(t.attributes.name)[0] ?? "");
}

function isExcluded(manga: Pick<MangaAttributes, "tags">) {
  return tagNames(manga).some((name) => EXCLUDED_TAGS.has(name));
}

/** Ưu tiên tên tiếng Việt, rồi tiếng Anh, rồi tên gốc. */
function pickTitle(manga: Pick<MangaAttributes, "title" | "altTitles">) {
  const alt = (lang: string) => manga.altTitles.find((t) => t[lang])?.[lang];
  return (alt(LANGUAGE) ?? manga.title.en ?? alt("en") ?? Object.values(manga.title)[0] ?? "").trim();
}

function chapterNumber(raw: string | null) {
  if (raw === null) return Number.NaN;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function groupNames(chapter: ChapterData) {
  return chapter.relationships
    .filter((r) => r.type === "scanlation_group" && r.attributes?.name)
    .map((r) => r.attributes!.name!);
}

/** Mô tả dạng Markdown → HTML các đoạn <p> (bỏ link, chữ đậm/nghiêng, đường kẻ, phần liên kết ngoài). */
function markdownToHtml(md: string) {
  const lines = md
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
        .replace(/^\s*(#+|>|[-*]\s)\s*/, "")
        .trim(),
    )
    .filter((l) => l && !/^[-*_]{3,}$/.test(l));
  return linesToHtml(lines);
}

/** "/chapter" mới đăng gần nhất → các truyện có chương mới (kèm số chương lớn nhất thấy được trong trang). */
export function parseMangadexLatest(json: ListResponse<ChapterData>): StoryListPage {
  const byManga = new Map<string, StoryRef>();
  for (const chapter of json.data) {
    const manga = chapter.relationships.find((r) => r.type === "manga");
    const attrs = manga?.attributes;
    if (!manga || !attrs?.title || isExcluded({ tags: attrs.tags ?? [] })) continue;
    const number = chapterNumber(chapter.attributes.chapter);
    const ref = byManga.get(manga.id) ?? {
      path: `/manga/${manga.id}`,
      title: pickTitle({ title: attrs.title, altTitles: attrs.altTitles ?? [] }),
    };
    if (Number.isFinite(number) && (ref.latestChapter === undefined || number > ref.latestChapter)) {
      ref.latestChapter = number;
    }
    byManga.set(manga.id, ref);
  }
  const next = json.offset + json.limit;
  return { items: [...byManga.values()], hasNext: next < json.total && next + json.limit <= MAX_OFFSET };
}

export function parseMangadexStory(json: { data: MangaData }, path: string): StoryDetail {
  const { id, attributes: a, relationships } = json.data;
  if (isExcluded(a)) throw new ParseError("Truyện có nội dung bị loại trừ", path);
  const title = pickTitle(a);
  if (!title) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const altTitles = [
    ...Object.values(a.title),
    ...a.altTitles.filter((t) => t[LANGUAGE] || t.en || t["ja-ro"] || t.ja || t.ko || t.zh).flatMap(Object.values),
  ]
    .map((t) => t.trim())
    .filter((t, i, all) => t && t !== title && all.indexOf(t) === i)
    .slice(0, 8);

  const genres = [
    ...tagNames(a).flatMap((name) => TAG_TO_GENRE[name] ?? []),
    ...(ORIGIN_TO_GENRE[a.originalLanguage] ? [ORIGIN_TO_GENRE[a.originalLanguage]!] : []),
  ];
  const authors = relationships.filter((r) => r.type === "author" && r.attributes?.name).map((r) => r.attributes!.name!);
  const cover = relationships.find((r) => r.type === "cover_art")?.attributes?.fileName;
  const description = a.description[LANGUAGE] ?? a.description.en;
  const status: StoryStatus = a.status === "completed" ? "COMPLETED" : a.status === "ongoing" ? "ONGOING" : "UNKNOWN";

  return {
    path,
    title,
    altTitles,
    author: authors.length ? [...new Set(authors)].join(", ") : undefined,
    genres: [...new Set(genres)],
    status,
    coverUrl: cover ? `${UPLOADS}/covers/${id}/${cover}.512.jpg` : undefined,
    description: description ? markdownToHtml(description) || undefined : undefined,
  };
}

/**
 * Feed chương tiếng Việt → danh sách chương. Một số chương có nhiều nhóm cùng dịch: giữ bản của nhóm
 * dịch nhiều chương nhất (đọc liền mạch hơn), hoà thì giữ bản đăng sớm hơn.
 */
export function parseMangadexChapters(chapters: ChapterData[]): ChapterRef[] {
  const usable = chapters.filter((c) => !c.attributes.isUnavailable && !c.attributes.externalUrl && c.attributes.pages > 0);
  const groupSize = new Map<string, number>();
  for (const c of usable) for (const g of groupNames(c)) groupSize.set(g, (groupSize.get(g) ?? 0) + 1);
  const weight = (c: ChapterData) => Math.max(0, ...groupNames(c).map((g) => groupSize.get(g) ?? 0));

  // Gộp theo giá trị số ("1" và "1.0" là một chương); chương không có số (oneshot, "Extra") giữ riêng.
  const byNumber = new Map<number, ChapterData>();
  const unnumbered: ChapterData[] = [];
  for (const c of usable) {
    const key = chapterNumber(c.attributes.chapter);
    if (!Number.isFinite(key)) {
      unnumbered.push(c);
      continue;
    }
    const current = byNumber.get(key);
    if (
      !current ||
      weight(c) > weight(current) ||
      (weight(c) === weight(current) && c.attributes.readableAt < current.attributes.readableAt)
    ) {
      byNumber.set(key, c);
    }
  }

  const refs = [...[...byNumber.entries()].sort(([a], [b]) => a - b).map(([, c]) => c), ...unnumbered]
    .map((c): ChapterRef => {
      const groups = groupNames(c);
      return {
        path: `/chapter/${c.id}`,
        number: chapterNumber(c.attributes.chapter),
        title: c.attributes.title?.trim() || (c.attributes.chapter === null ? "Oneshot" : undefined),
        credit: groups.length ? groups.join(" & ") : undefined,
      };
    });
  return ensureUniqueNumbers(refs);
}

/** Lưu URL theo máy chủ gốc (không hết hạn như node MangaDex@Home), chất lượng data-saver để tiết kiệm băng thông. */
export function parseMangadexAtHome(json: AtHomeResponse): ChapterContent {
  const { hash, data, dataSaver } = json.chapter;
  const [quality, files] = dataSaver.length ? ["data-saver", dataSaver] : ["data", data];
  if (!files.length) throw new ParseError("Chương không có ảnh");
  return { kind: "images", urls: files.map((f) => `${UPLOADS}/${quality}/${hash}/${f}`) };
}

// ---------- Adapter ----------

function userAgent() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL;
  return `KhoTruyen/1.0${site ? ` (+${site})` : ""}`;
}

export class MangadexAdapter extends BaseAdapter {
  readonly key = "mangadex";
  readonly type = "COMIC" as const;
  readonly imageHosts = ["uploads.mangadex.org"];

  private api<T>(path: string, params: [string, string | number][] = []): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [k, v] of params) url.searchParams.append(k, String(v));
    // MangaDex yêu cầu User-Agent thật (không giả trình duyệt), không cần Referer.
    return this.http.getJson<T>(url.toString(), {
      minIntervalMs: this.minIntervalMs,
      headers: { "User-Agent": userAgent() },
    });
  }

  private ratings(): [string, string][] {
    return CONTENT_RATINGS.map((r) => ["contentRating[]", r]);
  }

  async listLatest(page: number): Promise<StoryListPage> {
    const json = await this.api<ListResponse<ChapterData>>("/chapter", [
      ["translatedLanguage[]", LANGUAGE],
      ["order[readableAt]", "desc"],
      ["limit", LATEST_PAGE_SIZE],
      ["offset", (Math.max(1, page) - 1) * LATEST_PAGE_SIZE],
      ["includes[]", "manga"],
      ...this.ratings(),
      ["includeExternalUrl", 0],
      ["includeEmptyPages", 0],
      ["includeFuturePublishAt", 0],
    ]);
    return parseMangadexLatest(json);
  }

  async getStory(path: string): Promise<StoryDetail> {
    const json = await this.api<{ data: MangaData }>(path, [
      ["includes[]", "cover_art"],
      ["includes[]", "author"],
    ]);
    return parseMangadexStory(json, path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    const all: ChapterData[] = [];
    for (let offset = 0; offset < MAX_OFFSET; offset += FEED_PAGE_SIZE) {
      const json = await this.api<ListResponse<ChapterData>>(`${storyPath}/feed`, [
        ["translatedLanguage[]", LANGUAGE],
        ["order[chapter]", "asc"],
        ["limit", FEED_PAGE_SIZE],
        ["offset", offset],
        ["includes[]", "scanlation_group"],
        ...this.ratings(),
        ["includeExternalUrl", 0],
        ["includeEmptyPages", 0],
        ["includeFuturePublishAt", 0],
      ]);
      all.push(...json.data);
      if (offset + FEED_PAGE_SIZE >= json.total) break;
    }
    return parseMangadexChapters(all);
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    const id = chapterPath.replace(/^\/chapter\//, "");
    return parseMangadexAtHome(await this.api<AtHomeResponse>(`/at-home/server/${id}`));
  }

  imageHeaders(): Record<string, string> {
    return { "User-Agent": userAgent() };
  }

  /** Trang tương ứng trên mangadex.org (để ghi công/dẫn link) */
  webUrl(path: string): string {
    return `https://mangadex.org${path.replace(/^\/manga\//, "/title/")}`;
  }
}
