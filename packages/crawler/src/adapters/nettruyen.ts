import { absoluteUrl, chapterNumberFromPath, loadHtml, stripHidden, text, toPath } from "../html";
import { linesToHtml } from "../normalize";
import type { ChapterContent, ChapterRef, StoryDetail, StoryListPage, StoryRef } from "../types";
import { BaseAdapter, ParseError, ensureUniqueNumbers, parseStatus } from "./base";

/** Tên tác giả giả mà nguồn điền khi không có thông tin */
const PLACEHOLDER_AUTHORS = /^(truyenqq|nettruyen|đang cập nhật|updating|khác|n\/a)$/i;

/** Câu SEO/quảng cáo nguồn (hoặc trang nguồn gốc của truyện) chèn vào phần mô tả */
const SEO_LINE =
  /nettruyen|toptruyen|truyenqq|kể từ khi ra mắt|lượt xem|phát hành đến chapter|không chỉ hấp dẫn|được chấp bút bởi|đăng ký tài khoản|cập nhật sớm nhất|bình luận và chia sẻ/i;

const PLAIN_CHAPTER_NAME = /^(chapter|chương|chap)\s*[\d.]+$/i;

interface ChapterListResponse {
  data: Array<{ chapter_num: number; chapter_name: string }>;
}

function storySlug(path: string): string {
  const slug = path.match(/\/truyen-tranh\/([^/?#]+)/)?.[1];
  if (!slug) throw new ParseError("Đường dẫn truyện không hợp lệ", path);
  return slug;
}

const chapterTitle = (name: string) => {
  const trimmed = name.trim();
  return trimmed && !PLAIN_CHAPTER_NAME.test(trimmed) ? trimmed : undefined;
};

export function parseNettruyenList(html: string, baseUrl: string): StoryListPage {
  const $ = loadHtml(html);
  const items: StoryRef[] = [];
  $(".items .item").each((_, item) => {
    const $item = $(item);
    const link = $item.find("figcaption h3 a").first();
    const href = link.attr("href");
    if (!href) return;
    const img = $item.find(".image img").first();
    const latestHref = $item.find("ul.comic-item li.chapter a").first().attr("href");
    items.push({
      path: toPath(href, baseUrl),
      title: text(link),
      coverUrl: img.attr("data-original") ?? img.attr("data-src"),
      latestChapter: latestHref ? chapterNumberFromPath(latestHref) : undefined,
    });
  });
  const hasNext = $(".pagination a").filter((_, a) => text($(a)) === "›").length > 0;
  return { items, hasNext };
}

export function parseNettruyenStory(html: string, baseUrl: string, path: string): StoryDetail {
  const $ = loadHtml(html);
  const detail = $("#item-detail").first();
  if (!detail.length) throw new ParseError("Không tìm thấy khối thông tin truyện", path);
  stripHidden($, detail);

  const title = text(detail.find("h1.title-detail").first());
  if (!title) throw new ParseError("Không tìm thấy tiêu đề truyện", path);

  const field = (cls: string) => detail.find(`li.${cls} p`).last();
  const author = text(field("author"));
  const altTitles = text(field("othername"))
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== title);

  // Mô tả: các khối <div>, mỗi dòng xuống hàng là một đoạn; bỏ các câu SEO của nguồn.
  const lines = detail
    .find(".detail-content .shortened > div, .detail-content > p")
    .map((_, el) => $(el).text())
    .get()
    .flatMap((t) => t.split(/\n+/))
    .filter((l) => !SEO_LINE.test(l));
  const description = linesToHtml([...new Set(lines)]);

  const cover = detail.find(".col-image img").first();
  return {
    path,
    title,
    altTitles,
    author: author && !PLACEHOLDER_AUTHORS.test(author) ? author : undefined,
    genres: field("kind")
      .find("a")
      .map((_, a) => text($(a)))
      .get()
      .filter(Boolean),
    status: parseStatus(text(field("status"))),
    coverUrl: cover.attr("data-src") ?? cover.attr("src"),
    description: description || undefined,
  };
}

/** Danh sách chương từ HTML trang truyện — chỉ có ~20 chương mới nhất, dùng khi API lỗi. */
export function parseNettruyenChapterListHtml(html: string, baseUrl: string): ChapterRef[] {
  const $ = loadHtml(html);
  return $("#chapter_list li .chapter a")
    .map((_, a) => {
      const path = toPath($(a).attr("href") ?? "", baseUrl);
      return { path, number: chapterNumberFromPath(path) ?? Number.NaN, title: chapterTitle(text($(a))) };
    })
    .get();
}

export function parseNettruyenChapterListJson(data: ChapterListResponse, slug: string): ChapterRef[] {
  return data.data.map((c) => ({
    path: `/truyen-tranh/${slug}/chuong-${c.chapter_num}`,
    number: Number(c.chapter_num),
    title: chapterTitle(c.chapter_name ?? ""),
  }));
}

export function parseNettruyenChapter(html: string, baseUrl: string): ChapterContent {
  const $ = loadHtml(html);
  const siteHost = new URL(baseUrl).host;
  const urls = $(".reading-detail .page-chapter img")
    .map((_, img) => {
      const $img = $(img);
      const src = $img.attr("data-src") ?? $img.attr("data-sv1") ?? $img.attr("src");
      return src ? absoluteUrl(src.trim(), baseUrl) : undefined;
    })
    .get()
    // Ảnh nằm trên chính domain nguồn là ảnh thông báo/quảng cáo, không phải trang truyện.
    .filter((u): u is string => !!u && new URL(u).host !== siteHost);

  if (!urls.length) throw new ParseError("Không tìm thấy ảnh trong chương");
  return { kind: "images", urls };
}

export class NettruyenAdapter extends BaseAdapter {
  readonly key = "nettruyen";
  readonly type = "COMIC" as const;
  readonly imageHosts = ["kcgsbok.com"];

  async listLatest(page: number): Promise<StoryListPage> {
    const path = page <= 1 ? "/trang-chu" : `/trang-chu?page=${page}`;
    return parseNettruyenList(await this.fetchHtml(path), this.baseUrl);
  }

  async getStory(path: string): Promise<StoryDetail> {
    return parseNettruyenStory(await this.fetchHtml(path), this.baseUrl, path);
  }

  async getChapterList(storyPath: string): Promise<ChapterRef[]> {
    const slug = storySlug(storyPath);
    try {
      const data = await this.fetchJson<ChapterListResponse>(
        `/Comic/Services/ComicService.asmx/ChapterList?slug=${encodeURIComponent(slug)}`,
        this.url(storyPath),
      );
      return ensureUniqueNumbers(parseNettruyenChapterListJson(data, slug));
    } catch (error) {
      const fallback = parseNettruyenChapterListHtml(await this.fetchHtml(storyPath), this.baseUrl);
      if (!fallback.length) throw error;
      return ensureUniqueNumbers(fallback);
    }
  }

  async getChapterContent(chapterPath: string): Promise<ChapterContent> {
    return parseNettruyenChapter(await this.fetchHtml(chapterPath), this.baseUrl);
  }
}
