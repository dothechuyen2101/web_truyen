import { absoluteUrl, loadHtml, stripHidden, text, toPath } from "../html";
import { linesToHtml } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers, parseStatus } from "./base";

/** Tên tác giả giả khi nguồn không có thông tin */
const PLACEHOLDER_AUTHORS = /^(đang cập nhật|updating|truyenqq|n\/a|khác)$/i;

/** Câu SEO nguồn chèn vào phần mô tả */
const SEO_LINE =
  /truyenqq|kể từ khi ra mắt|lượt xem|không chỉ hấp dẫn|được chấp bút bởi|theo dõi .* để cập nhật|phát hành đến chương|bản dịch của/i;

const PLAIN_CHAPTER_NAME = /^(chapter|chương|chap)\s*[\d.]+$/i;

/** ".../ten-truyen-123-chap-12" -> 12; chương lẻ dùng dấu gạch: "-chap-34-1" -> 34.1 */
function chapterNumber(path: string): number | undefined {
  const m = path.match(/-chap-(\d+)(?:[.-](\d+))?(?:[/?#]|$)/i);
  if (!m?.[1]) return undefined;
  return Number(m[2] ? `${m[1]}.${m[2]}` : m[1]);
}

export function parseTruyenqqList(html: string, baseUrl: string, page = 1): StoryListPage {
  const $ = loadHtml(html);
  const items: StoryRef[] = [];
  $("#main_homepage .list_grid li").each((_, li) => {
    const $li = $(li);
    const link = $li.find(".book_name h3 a").first();
    const href = link.attr("href");
    if (!href) return;
    const img = $li.find(".book_avatar img").first();
    const latestHref = $li.find(".last_chapter a").first().attr("href");
    items.push({
      path: toPath(href, baseUrl),
      title: link.attr("title")?.trim() || text(link),
      coverUrl: img.attr("data-src") ?? img.attr("src"),
      latestChapter: latestHref ? chapterNumber(latestHref) : undefined,
    });
  });
  const hasNext = $(".page_redirect a").filter((_, a) => ($(a).attr("href") ?? "").endsWith(`/trang-${page + 1}`)).length > 0;
  return { items, hasNext };
}

export function parseTruyenqqStory(html: string, baseUrl: string, path: string): StoryDetail {
  const $ = loadHtml(html);
  const detail = $(".book_detail").first();
  if (!detail.length) throw new ParseError("Không tìm thấy khối thông tin truyện", path);
  stripHidden($, detail);

  const title = text(detail.find("h1[itemprop=name]").first());
  if (!title) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const author = text(detail.find("li.author p").last());
  const altTitles = text(detail.find("li.othername p, .book_other h2.other-name").last())
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== title);

  const lines = detail
    .find(".story-detail-info p")
    .map((_, p) => $(p).text())
    .get()
    .flatMap((t) => t.split(/\n+/))
    .filter((l) => !SEO_LINE.test(l));
  const description = linesToHtml([...new Set(lines)]);

  return {
    path,
    title,
    altTitles,
    author: author && !PLACEHOLDER_AUTHORS.test(author) ? author : undefined,
    genres: detail
      .find("ul.list01 li a")
      .map((_, a) => text($(a)))
      .get()
      .filter(Boolean),
    status: parseStatus(text(detail.find("li.status p").last())),
    coverUrl: detail.find(".book_avatar img").first().attr("src"),
    description: description || undefined,
  };
}

export function parseTruyenqqChapterList(html: string, baseUrl: string): ChapterRef[] {
  const $ = loadHtml(html);
  const seen = new Set<string>();
  const chapters: ChapterRef[] = [];
  $(".works-chapter-list .works-chapter-item a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const path = toPath(href, baseUrl);
    if (seen.has(path)) return;
    seen.add(path);
    const name = text($(a));
    chapters.push({
      path,
      number: chapterNumber(path) ?? Number.NaN,
      title: name && !PLAIN_CHAPTER_NAME.test(name) ? name : undefined,
    });
  });
  return chapters;
}

export function parseTruyenqqChapter(html: string, baseUrl: string): ChapterContent {
  const $ = loadHtml(html);
  const siteHost = new URL(baseUrl).hostname;
  const urls = $(".page-chapter img")
    .map((_, img) => {
      const $img = $(img);
      const src = $img.attr("data-cdn") ?? $img.attr("data-original") ?? $img.attr("src");
      return src ? absoluteUrl(src.trim(), baseUrl) : undefined;
    })
    .get()
    // Ảnh trên chính domain nguồn (st.<domain>) là ảnh thông báo, không phải trang truyện.
    .filter((u): u is string => !!u && !new URL(u).hostname.endsWith(siteHost));

  if (!urls.length) throw new ParseError("Không tìm thấy ảnh trong chương");
  return { kind: "images", urls: [...new Set(urls)] };
}

export class TruyenqqAdapter extends BaseAdapter {
  readonly key = "truyenqq";
  readonly type = "COMIC" as const;
  readonly imageHosts = ["truyenvua.com", "hinhhinh.com"];

  async listLatest(page: number): Promise<StoryListPage> {
    const path = page <= 1 ? "/truyen-moi-cap-nhat" : `/truyen-moi-cap-nhat/trang-${page}`;
    return parseTruyenqqList(await this.fetchHtml(path), this.baseUrl, page);
  }

  async getStory(path: string): Promise<StoryDetail> {
    return parseTruyenqqStory(await this.fetchHtml(path), this.baseUrl, path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    return ensureUniqueNumbers(parseTruyenqqChapterList(await this.fetchHtml(storyPath), this.baseUrl));
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    return parseTruyenqqChapter(await this.fetchHtml(chapterPath), this.baseUrl);
  }
}
