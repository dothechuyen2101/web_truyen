import { loadHtml, text, toPath } from "../html";
import { linesToHtml } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers, parseStatus } from "./base";

/**
 * manhuavn (manhuavn2.com) — truyện tranh Trung Quốc, không chặn IP máy chủ.
 * Phần lớn chương mới chỉ có trên app của nguồn (trang chương hiện khối "vip-lock"); trên web thường chỉ
 * mở vài chương đầu. Adapter chỉ đưa lên các chương đọc được, không tìm cách mở chương bị khoá.
 * robots.txt cấm /ajax/ và /api/ → chỉ đọc trang HTML.
 */

/** Tên khác giả (mã nội bộ của nguồn) */
const INTERNAL_CODE = /^MHVN\d+$/i;
const PLACEHOLDER_AUTHORS = /^(đang cập nhật|updating|n\/a|khác)$/i;
/** Chương không phải truyện tranh: video, thông báo */
const NON_COMIC = /video|thong-bao|thông báo/i;
/** Thường chỉ 5 chương đầu đọc được trên web → kiểm tra quanh mốc này trước khi tìm nhị phân */
const FREE_GUESSES = [4, 5];

/** Thể loại của nguồn → tên thể loại của site */
const GENRE_ALIASES: Record<string, string> = {
  "Trùng Sinh": "Trọng Sinh",
  "Hậu Cung": "Harem",
  "Hàn Quốc": "Manhwa",
  "Kinh Dị": "Horror",
};

function chapterNumber(label: string, path: string): number | undefined {
  const m = label.match(/chap(?:ter)?\s*(\d+(?:\.\d+)?)/i) ?? path.match(/chapter-?(\d+(?:\.\d+)?)/i);
  return m?.[1] ? Number(m[1]) : undefined;
}

export function parseManhuavnList(html: string, baseUrl: string, page = 1): StoryListPage {
  const $ = loadHtml(html);
  const items: StoryRef[] = [];
  $("li.story_item").each((_, li) => {
    const $li = $(li);
    const href = $li.find("a[itemprop=url]").first().attr("href");
    const title = text($li.find(".story_title").first());
    if (!href || !title) return;
    const latest = text($li.find(".linkchap").first());
    // Trang chủ dùng <img data-original>, trang danh sách dùng background-image.
    const image = $li.find(".story_img");
    const cover =
      image.find("img").first().attr("data-original") ?? image.attr("style")?.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    items.push({
      path: toPath(href, baseUrl),
      title,
      coverUrl: cover,
      latestChapter: chapterNumber(latest, ""),
    });
  });
  const hasNext = $(`a[href*="/danhsach/P${page + 1}/"]`).length > 0;
  return { items, hasNext };
}

export function parseManhuavnStory(html: string, path: string): StoryDetail {
  const $ = loadHtml(html);
  const title = text($("h1.title").first());
  if (!title) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const info = $("ul.list-info").first();
  const row = (label: string) => info.find("li").filter((_, li) => $(li).text().includes(label)).first();
  const after = (label: string) => text(row(label)).split(label).pop()?.replace(/^\s*:\s*/, "").trim() ?? "";

  const altTitles = after("Tên Khác")
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter((t) => t && t !== title && !INTERNAL_CODE.test(t));
  const author = after("Tác Giả");

  const sourceGenres = info.find("li:has(i.fa-tags) a").map((_, a) => text($(a))).get().filter(Boolean);
  const genres = sourceGenres.map((g) => GENRE_ALIASES[g] ?? g);
  // Nguồn chủ yếu là truyện Trung Quốc; truyện Hàn có thể loại "Hàn Quốc" (→ Manhwa).
  if (!genres.includes("Manhwa")) genres.push("Manhua");

  const intro = info.find("li:has(h2)").first().clone();
  intro.find("h2, a, script").remove();
  const description = linesToHtml(intro.text().split(/\n+/));

  return {
    path,
    title,
    altTitles,
    author: author && !PLACEHOLDER_AUTHORS.test(author) ? author : undefined,
    genres: [...new Set(genres)],
    status: parseStatus(text(row("Tình Trạng").find("span").first())),
    coverUrl: $(".wrap-content-image img").first().attr("src"),
    description: description || undefined,
  };
}

/** Link một chương bất kỳ trên trang truyện (trang chương nào cũng có ô chọn đủ danh sách chương). */
export function parseManhuavnAnyChapterLink(html: string, baseUrl: string): string | undefined {
  const $ = loadHtml(html);
  const href = $("ul.list-info a[href*='/doc-truyen/'], #lst-chapter a[href*='/doc-truyen/']").first().attr("href");
  return href ? toPath(href, baseUrl) : undefined;
}

/** Ô chọn chương trên trang đọc → toàn bộ chương (tăng dần), bỏ video/thông báo và bản trùng số. */
export function parseManhuavnChapterSelect(html: string, baseUrl: string): ChapterRef[] {
  const $ = loadHtml(html);
  const byNumber = new Map<number, ChapterRef>();
  $("#selectchaptertop option").each((_, opt) => {
    const value = $(opt).attr("value");
    const label = text($(opt));
    if (!value || NON_COMIC.test(value) || NON_COMIC.test(label)) return;
    const path = toPath(value, baseUrl);
    const number = chapterNumber(label, path);
    if (number === undefined || byNumber.has(number)) return;
    const title = label.replace(/^chap(?:ter)?\s*[\d.]+\s*[:\-–]*\s*/i, "").trim();
    byNumber.set(number, { path, number, title: title || undefined });
  });
  return ensureUniqueNumbers([...byNumber.values()]);
}

/** Chương đọc được trên web: không bị khoá vào app và có ảnh. */
export function isManhuavnChapterFree(html: string): boolean {
  const $ = loadHtml(html);
  return $(".vip-lock").length === 0 && chapterImages($).length > 0;
}

function chapterImages($: ReturnType<typeof loadHtml>) {
  return $("#lst_content img")
    .map((_, img) => $(img).attr("data-original") ?? $(img).attr("src"))
    .get()
    .filter((src) => src && /^https?:\/\//.test(src) && !src.includes("loading.gif"));
}

export function parseManhuavnChapter(html: string, path: string): ChapterContent {
  const $ = loadHtml(html);
  if ($(".vip-lock").length) throw new ParseError("Chương này chỉ có trên app của nguồn", path);
  const urls = chapterImages($);
  if (!urls.length) throw new ParseError("Không tìm thấy ảnh chương", path);
  return { kind: "images", urls };
}

/**
 * Số chương đầu đọc được trên web (chương mở là một đoạn liền từ đầu): thử mốc thường gặp rồi tìm nhị phân,
 * chỉ tốn vài request thay vì mở từng chương.
 */
export async function countFreePrefix(count: number, isFree: (index: number) => Promise<boolean>): Promise<number> {
  if (!count) return 0;
  if (await isFree(count - 1)) return count;
  let lo = -1; // chỉ số chương mở cuối cùng đã biết
  let hi = count - 1; // chỉ số chương khoá đầu tiên đã biết
  for (const guess of FREE_GUESSES) {
    if (guess <= lo || guess >= hi) continue;
    if (await isFree(guess)) lo = guess;
    else hi = guess;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await isFree(mid)) lo = mid;
    else hi = mid;
  }
  return lo + 1;
}

export class ManhuavnAdapter extends BaseAdapter {
  readonly key = "manhuavn";
  readonly type = "COMIC" as const;
  readonly imageHosts = ["g5img.top"];

  async listLatest(page: number): Promise<StoryListPage> {
    const html = await this.fetchHtml(`/danhsach/P${Math.max(1, page)}/index.html?status=0&sort=2`);
    return parseManhuavnList(html, this.baseUrl, page);
  }

  async getStory(path: string): Promise<StoryDetail> {
    return parseManhuavnStory(await this.fetchHtml(path), path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    const link = parseManhuavnAnyChapterLink(await this.fetchHtml(storyPath), this.baseUrl);
    if (!link) return [];
    const chapters = parseManhuavnChapterSelect(await this.fetchHtml(link), this.baseUrl);
    const free = await countFreePrefix(chapters.length, async (i) => {
      try {
        return isManhuavnChapterFree(await this.fetchHtml(chapters[i]!.path));
      } catch {
        return false;
      }
    });
    return chapters.map((c, i) => (i < free ? c : { ...c, unavailable: true }));
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    return parseManhuavnChapter(await this.fetchHtml(chapterPath), chapterPath);
  }
}
