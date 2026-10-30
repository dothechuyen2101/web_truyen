import { Agent, ProxyAgent, fetch, type Dispatcher } from "undici";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
];

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} khi tải ${url}`);
    this.name = "HttpError";
  }
}

export interface HttpClientOptions {
  /** Khoảng cách tối thiểu giữa 2 request tới cùng một host (ms) */
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
  /** Proxy ra ngoài, vd http://user:pass@host:port. Mặc định đọc CRAWLER_PROXY. */
  proxyUrl?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Ghi đè minIntervalMs cho request này (theo cấu hình rateLimitMs của nguồn) */
  minIntervalMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thời gian tạm dừng một host khi nó báo quá tải (429/503) mà không gửi Retry-After */
const DEFAULT_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 5 * 60_000;

export class HttpClient {
  private readonly dispatcher: Dispatcher;
  private readonly nextSlot = new Map<string, number>();
  /** Host đang quá tải → mọi request tới host đó chờ tới mốc này */
  private readonly cooldownUntil = new Map<string, number>();
  private uaIndex = Math.floor(Math.random() * USER_AGENTS.length);

  constructor(private readonly opts: HttpClientOptions = {}) {
    const proxyUrl = opts.proxyUrl ?? process.env.CRAWLER_PROXY;
    this.dispatcher = proxyUrl
      ? new ProxyAgent(proxyUrl)
      : new Agent({ keepAliveTimeout: 10_000, connections: 16 });
  }

  async getText(url: string, options: RequestOptions = {}): Promise<string> {
    const res = await this.request(url, options);
    return res.text();
  }

  async getBuffer(url: string, options: RequestOptions = {}): Promise<Buffer> {
    const res = await this.request(url, {
      ...options,
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", ...options.headers },
    });
    return Buffer.from(await res.arrayBuffer());
  }

  async getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.request(url, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
    });
    return (await res.json()) as T;
  }

  private async request(url: string, options: RequestOptions) {
    const retries = this.opts.retries ?? 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
      await this.waitForSlot(url, options.minIntervalMs ?? this.opts.minIntervalMs ?? 500);

      try {
        const res = await fetch(url, {
          dispatcher: this.dispatcher,
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
          headers: {
            "User-Agent": this.nextUserAgent(),
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
            ...options.headers,
          },
        });
        if (res.ok) return res;

        await res.body?.cancel();
        if (res.status === 429 || res.status === 503) this.coolDown(url, res.headers.get("retry-after"));
        const error = new HttpError(res.status, url);
        // 4xx (trừ 429) là lỗi cố định — thử lại cũng vô ích.
        if (res.status !== 429 && res.status < 500) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof HttpError && error.status !== 429 && error.status < 500) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  /** Nguồn báo quá tải: tạm dừng cả host (theo Retry-After nếu có) để các job song song không dồn thêm request. */
  private coolDown(url: string, retryAfter: string | null) {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_COOLDOWN_MS;
    const host = new URL(url).host;
    const until = Date.now() + Math.min(ms, MAX_COOLDOWN_MS);
    this.cooldownUntil.set(host, Math.max(until, this.cooldownUntil.get(host) ?? 0));
  }

  /** Giới hạn tốc độ theo host: mỗi request giữ một "slot" cách slot trước ít nhất intervalMs. */
  private async waitForSlot(url: string, intervalMs: number) {
    const host = new URL(url).host;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0, this.cooldownUntil.get(host) ?? 0);
    this.nextSlot.set(host, slot + intervalMs);
    if (slot > now) await sleep(slot - now);
  }

  private nextUserAgent() {
    this.uaIndex = (this.uaIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[this.uaIndex]!;
  }
}
