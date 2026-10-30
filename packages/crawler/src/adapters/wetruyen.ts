import { chapterNumberFromPath, cssHiddenClasses, loadHtml, stripHidden, text, toPath } from "../html";
import { brToParagraphs, cleanContentHtml, stripAuthorSuffix } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers, parseStatus } from "./base";

const WATERMARK = /wetruyen|dtruyen|webtruyen/i;

export function parseWetruyenList(html: string, baseUrl: string): StoryListPage {
  const $ = loadHtml(html);
  const items: StoryRef[] = [];
  $(".list-truyen .row[itemtype]").each((_, row) => {
    const $row = $(row);
    const link = $row.find("h3.truyen-title a").first();
    const href = link.attr("href");
    if (!href) return;
    // Hàng chỉ ghi "151 chương"; truyện chữ đánh số liên tục nên dùng làm số chương mới nhất.
    const count = text($row).match(/(\d+)\s*chương/i)?.[1];
    const lazy = $row.find("[data-image]").first();
    items.push({
      path: toPath(href, baseUrl),
      title: link.attr("title")?.trim() || text(link),
      coverUrl: lazy.attr("data-desk-image") ?? lazy.attr("data-image") ?? $row.find("img").first().attr("src"),
      latestChapter: count ? Number(count) : undefined,
    });
  });
  const hasNext = $(".pagination a").filter((_, a) => /next/i.test(text($(a)))).length > 0;
  return { items, hasNext };
}

export function parseWetruyenStory(html: string, baseUrl: string, path: string): StoryDetail {
  const $ = loadHtml(html);
  const hidden = cssHiddenClasses($);
  const info = $(".info-holder .info").first();
  if (!info.length) throw new ParseError("Không tìm thấy khối thông tin truyện", path);
  stripHidden($, info, hidden);

  const author = text(info.find("[itemprop=author]").first()) || undefined;
  const rawTitle = text($("[itemprop=name].title, h1.title").first());
  if (!rawTitle) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const desc = $(".desc-text").first();
  stripHidden($, desc, hidden);
  desc.find("p, div").each((_, el) => {
    if (WATERMARK.test($(el).text()) && $(el).text().length < 200) $(el).remove();
  });

  return {
    path,
    title: stripAuthorSuffix(rawTitle, author),
    altTitles: [],
    author,
    genres: info
      .find("[itemprop=genre]")
      .map((_, a) => text($(a)))
      .get()
      .filter(Boolean),
    status: parseStatus(text(info.find(".text-success, .text-primary").first())),
    coverUrl: $(".info-holder .book img").first().attr("src"),
    description: cleanContentHtml(brToParagraphs(desc.html() ?? "")) || undefined,
  };
}

export function parseWetruyenChapterPage(html: string, baseUrl: string): { chapters: ChapterRef[]; totalPages: number } {
  const $ = loadHtml(html);
  const list = $("#list-chapter");
  stripHidden($, list);

  const chapters: ChapterRef[] = [];
  list.find("ul.list-chapter li a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const path = toPath(href, baseUrl);
    const title = ($(a).attr("title") ?? text($(a))).match(/Chương\s*[\d.]+\s*[:\-–]?\s*(.*)$/i)?.[1]?.trim();
    chapters.push({ path, number: chapterNumberFromPath(path) ?? Number.NaN, title: title || undefined });
  });

  // Trang cuối nằm ở link "Last »" (…/trang-89/#chapter-list).
  const pages = $(".pagination a")
    .map((_, a) => Number(($(a).attr("href") ?? "").match(/\/trang-(\d+)\//)?.[1]))
    .get()
    .filter((n) => Number.isFinite(n));
  return { chapters, totalPages: Math.max(1, ...pages) };
}

export function parseWetruyenChapter(html: string): ChapterContent {
  const $ = loadHtml(html);
  const content = $("#chapter-c").first();
  if (!content.length) throw new ParseError("Không tìm thấy nội dung chương");

  stripHidden($, content);
  content.find("[id^=ads], [class*=ads]").remove();
  content.find("p, div").each((_, el) => {
    const t = $(el).text();
    if (WATERMARK.test(t) && t.length < 200) $(el).remove();
  });

  const cleaned = cleanContentHtml(brToParagraphs(content.html() ?? ""));
  if (!cleaned) throw new ParseError("Nội dung chương trống");
  return { kind: "text", html: cleaned };
}

export class WetruyenAdapter extends BaseAdapter {
  readonly key = "wetruyen";
  readonly type = "NOVEL" as const;
  readonly imageHosts = ["wetruyen.com"];

  async listLatest(page: number): Promise<StoryListPage> {
    const path = page <= 1 ? "/truyen-moi-cap-nhat/" : `/truyen-moi-cap-nhat/trang-${page}/`;
    return parseWetruyenList(await this.fetchHtml(path), this.baseUrl);
  }

  async getStory(path: string): Promise<StoryDetail> {
    return parseWetruyenStory(await this.fetchHtml(path), this.baseUrl, path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    const base = storyPath.endsWith("/") ? storyPath : `${storyPath}/`;
    const first = parseWetruyenChapterPage(await this.fetchHtml(base), this.baseUrl);
    const chapters = [...first.chapters];
    for (let page = 2; page <= first.totalPages; page++) {
      chapters.push(...parseWetruyenChapterPage(await this.fetchHtml(`${base}trang-${page}/`), this.baseUrl).chapters);
    }
    return ensureUniqueNumbers(chapters);
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    return parseWetruyenChapter(await this.fetchHtml(chapterPath));
  }
}
