import {
  chapterNumberFromPath,
  cssBeforeLabels,
  cssHiddenClasses,
  loadHtml,
  stripHidden,
  text,
  toPath,
} from "../html";
import { cleanContentHtml, stripAuthorSuffix } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers, parseStatus } from "./base";

const WATERMARK = /truyen\s*full/i;

export function parseTruyenfullList(html: string, baseUrl: string): StoryListPage {
  const $ = loadHtml(html);
  const items: StoryRef[] = [];
  $(".list-truyen .row[itemtype]").each((_, row) => {
    const $row = $(row);
    const link = $row.find("h3.truyen-title a").first();
    const href = link.attr("href");
    if (!href) return;
    const latestHref = $row.find(".text-info a").first().attr("href");
    items.push({
      path: toPath(href, baseUrl),
      title: link.attr("title")?.trim() || text(link),
      coverUrl: $row.find("img.cover").attr("src"),
      latestChapter: latestHref ? chapterNumberFromPath(latestHref) : undefined,
    });
  });
  const hasNext =
    $("ul.pagination a").filter((_, a) => /Trang tiếp/i.test($(a).text())).length > 0;
  return { items, hasNext };
}

export function parseTruyenfullStory(html: string, baseUrl: string, path: string): StoryDetail {
  const $ = loadHtml(html);
  const hidden = cssHiddenClasses($);
  const labels = cssBeforeLabels($);

  const info = $(".info-holder .info").first();
  if (!info.length) throw new ParseError("Không tìm thấy khối thông tin truyện", path);
  stripHidden($, info, hidden);

  const author = text(info.find("[itemprop=author]").first()) || undefined;
  const genres = info
    .find("[itemprop=genre]")
    .map((_, a) => text($(a)))
    .get()
    .filter(Boolean);

  // Nhãn các dòng thông tin được gắn bằng CSS :before với class ngẫu nhiên.
  let statusText = "";
  info.children("div").each((_, div) => {
    const classes = ($(div).attr("class") ?? "").split(/\s+/);
    const label = text($(div).find("h3").first()) || classes.map((c) => labels.get(c)).find(Boolean);
    if (label && /trạng thái/i.test(label)) statusText = text($(div).find("span").first());
  });
  statusText ||= text(info.find(".text-success, .text-primary").first());

  const rawTitle = text($("h3.title[itemprop=name]").first()) || text($("h3.title").first());
  if (!rawTitle) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const desc = $(".desc-text").first();
  stripHidden($, desc, hidden);
  desc.find("p, div").each((_, el) => {
    if (WATERMARK.test($(el).text())) $(el).remove();
  });

  return {
    path,
    title: stripAuthorSuffix(rawTitle, author),
    altTitles: [],
    author,
    genres,
    status: parseStatus(statusText),
    coverUrl: $(".info-holder .book img").first().attr("src"),
    description: cleanContentHtml(desc.html() ?? "") || undefined,
  };
}

export function parseTruyenfullChapterPage(
  html: string,
  baseUrl: string,
): { chapters: ChapterRef[]; totalPages: number } {
  const $ = loadHtml(html);
  const list = $("#list-chapter");
  stripHidden($, list);

  const chapters: ChapterRef[] = [];
  list.find("ul.list-chapter li a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const path = toPath(href, baseUrl);
    const number = chapterNumberFromPath(path);
    // title="<Tên truyện> - Chương 1: Tên chương"
    const title = ($(a).attr("title") ?? text($(a))).match(/Chương\s*[\d.]+\s*[:\-–]?\s*(.*)$/i)?.[1];
    chapters.push({ path, number: number ?? Number.NaN, title: title?.trim() || undefined });
  });

  const totalPages = Number($("#total-page").attr("value")) || 1;
  return { chapters, totalPages };
}

export function parseTruyenfullChapter(html: string): ChapterContent {
  const $ = loadHtml(html);
  const content = $("#chapter-c").first();
  if (!content.length) throw new ParseError("Không tìm thấy nội dung chương");

  stripHidden($, content);
  content.find("[id^=ads], [class*=ads]").remove();
  content.find("p, div").each((_, el) => {
    const t = $(el).text();
    if (WATERMARK.test(t) && t.length < 200) $(el).remove();
  });

  const cleaned = cleanContentHtml(content.html() ?? "");
  if (!cleaned) throw new ParseError("Nội dung chương trống");
  return { kind: "text", html: cleaned };
}

export class TruyenfullAdapter extends BaseAdapter {
  readonly key = "truyenfull";
  readonly type = "NOVEL" as const;
  readonly imageHosts = ["truyenfull.live", "truyenfull.vn", "8cache.com"];

  async listLatest(page: number): Promise<StoryListPage> {
    const path = page <= 1 ? "/danh-sach/truyen-moi/" : `/danh-sach/truyen-moi/trang-${page}/`;
    return parseTruyenfullList(await this.fetchHtml(path), this.baseUrl);
  }

  async getStory(path: string): Promise<StoryDetail> {
    return parseTruyenfullStory(await this.fetchHtml(path), this.baseUrl, path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    const base = storyPath.endsWith("/") ? storyPath : `${storyPath}/`;
    const first = parseTruyenfullChapterPage(await this.fetchHtml(base), this.baseUrl);
    const chapters = [...first.chapters];
    for (let page = 2; page <= first.totalPages; page++) {
      const next = parseTruyenfullChapterPage(
        await this.fetchHtml(`${base}trang-${page}/`),
        this.baseUrl,
      );
      chapters.push(...next.chapters);
    }
    return ensureUniqueNumbers(chapters);
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    return parseTruyenfullChapter(await this.fetchHtml(chapterPath));
  }
}
