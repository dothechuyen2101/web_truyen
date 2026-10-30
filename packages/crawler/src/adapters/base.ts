import type { HttpClient } from "../http";
import type {
  ChapterContent,
  ChapterRef,
  SourceAdapter,
  StoryDetail,
  StoryListPage,
  StoryType,
} from "../types";

export class ParseError extends Error {
  constructor(message: string, readonly url?: string) {
    super(url ? `${message} (${url})` : message);
    this.name = "ParseError";
  }
}

export interface AdapterOptions {
  baseUrl: string;
  http: HttpClient;
  /** Khoảng cách tối thiểu giữa 2 request (Source.rateLimitMs) */
  minIntervalMs?: number;
}

const PAGE_CACHE_TTL_MS = 60_000;
const PAGE_CACHE_SIZE = 20;

export abstract class BaseAdapter implements SourceAdapter {
  abstract readonly key: string;
  abstract readonly type: StoryType;
  abstract readonly imageHosts: string[];

  readonly baseUrl: string;
  protected readonly http: HttpClient;
  protected readonly minIntervalMs?: number;
  // getStory rồi getChapterList thường tải lại cùng một trang — giữ tạm vài trang gần nhất.
  private readonly pageCache = new Map<string, { html: string; at: number }>();

  constructor(opts: AdapterOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.http = opts.http;
    this.minIntervalMs = opts.minIntervalMs;
  }

  abstract listLatest(page: number): Promise<StoryListPage>;
  abstract getStory(path: string): Promise<StoryDetail>;
  abstract getChapterList(storyPath: string): Promise<ChapterRef[]>;
  abstract getChapterContent(chapterPath: string): Promise<ChapterContent>;

  imageHeaders(_imageUrl: string): Record<string, string> {
    return { Referer: `${this.baseUrl}/` };
  }

  url(path: string): string {
    return new URL(path, `${this.baseUrl}/`).toString();
  }

  webUrl(path: string): string {
    return this.url(path);
  }

  protected async fetchHtml(path: string): Promise<string> {
    const url = this.url(path);
    const cached = this.pageCache.get(url);
    if (cached && Date.now() - cached.at < PAGE_CACHE_TTL_MS) return cached.html;

    const html = await this.http.getText(url, {
      minIntervalMs: this.minIntervalMs,
      headers: { Referer: `${this.baseUrl}/` },
    });
    this.pageCache.set(url, { html, at: Date.now() });
    if (this.pageCache.size > PAGE_CACHE_SIZE) {
      this.pageCache.delete(this.pageCache.keys().next().value!);
    }
    return html;
  }

  protected fetchJson<T>(path: string, referer?: string): Promise<T> {
    return this.http.getJson<T>(this.url(path), {
      minIntervalMs: this.minIntervalMs,
      headers: { Referer: referer ?? `${this.baseUrl}/`, "X-Requested-With": "XMLHttpRequest" },
    });
  }
}

const TITLE_NUMBER = /(?:chương|chapter|chap)\s*(\d+(?:\.\d+)?)/i;

/**
 * Chuẩn hoá số chương (giữ đúng số của nguồn để ghép chương giữa các nguồn):
 * - thiếu số: đọc từ tiêu đề, không được thì chèn số lẻ ngay sau chương liền trước;
 * - số trùng (truyện chia quyển, mỗi quyển đánh lại từ 1): đánh lại toàn bộ theo thứ tự.
 * `chapters` theo thứ tự hiển thị của nguồn (tăng hoặc giảm dần đều được).
 */
export function ensureUniqueNumbers(chapters: ChapterRef[]): ChapterRef[] {
  const withTitles = chapters.map((c) => {
    if (Number.isFinite(c.number)) return c;
    const fromTitle = c.title?.match(TITLE_NUMBER)?.[1];
    return fromTitle ? { ...c, number: Number(fromTitle) } : c;
  });

  const known = withTitles.filter((c) => Number.isFinite(c.number)).map((c) => c.number);
  if (new Set(known).size !== known.length) {
    // Danh sách giảm dần thì đảo lại trước khi đánh số theo thứ tự đọc.
    const ordered = known.length > 1 && known[0]! > known.at(-1)! ? [...withTitles].reverse() : withTitles;
    return ordered.map((c, i) => ({ ...c, number: i + 1 }));
  }

  const ascending = known.length < 2 || known[0]! <= known.at(-1)!;
  const ordered = ascending ? withTitles : [...withTitles].reverse();
  const used = new Set(known);
  let previous = 0;
  const result = ordered.map((c) => {
    if (Number.isFinite(c.number)) {
      previous = c.number;
      return c;
    }
    let n = Math.round((previous + 0.01) * 100) / 100;
    while (used.has(n)) n = Math.round((n + 0.01) * 100) / 100;
    used.add(n);
    previous = n;
    return { ...c, number: n };
  });
  return result.sort((a, b) => a.number - b.number);
}

export function parseStatus(raw: string): "ONGOING" | "COMPLETED" | "UNKNOWN" {
  if (/full|hoàn\s*thành|đã\s*hoàn|completed/i.test(raw)) return "COMPLETED";
  if (/đang|ongoing|tiến hành/i.test(raw)) return "ONGOING";
  return "UNKNOWN";
}
