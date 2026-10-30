import { HttpClient } from "../http";
import type { SourceAdapter } from "../types";
import type { AdapterOptions } from "./base";
import { MangadexAdapter } from "./mangadex";
import { NettruyenAdapter } from "./nettruyen";
import { TruyenfullAdapter } from "./truyenfull";
import { TruyenqqAdapter } from "./truyenqq";
import { WetruyenAdapter } from "./wetruyen";

const ADAPTERS: Record<string, new (opts: AdapterOptions) => SourceAdapter> = {
  truyenfull: TruyenfullAdapter,
  nettruyen: NettruyenAdapter,
  truyenqq: TruyenqqAdapter,
  wetruyen: WetruyenAdapter,
  mangadex: MangadexAdapter,
};

export const adapterKeys = Object.keys(ADAPTERS);

let sharedHttp: HttpClient | undefined;
const cache = new Map<string, SourceAdapter>();

/** Tạo (hoặc lấy lại) adapter theo cấu hình Source trong DB. Dùng chung một HttpClient để giới hạn tốc độ theo host. */
export function getAdapter(source: { key: string; baseUrl: string; rateLimitMs?: number }): SourceAdapter {
  const cacheKey = `${source.key}|${source.baseUrl}|${source.rateLimitMs ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const Adapter = ADAPTERS[source.key];
  if (!Adapter) throw new Error(`Chưa có adapter cho nguồn "${source.key}"`);
  sharedHttp ??= new HttpClient();
  const adapter = new Adapter({
    baseUrl: source.baseUrl,
    http: sharedHttp,
    minIntervalMs: source.rateLimitMs,
  });
  cache.set(cacheKey, adapter);
  return adapter;
}

/** Host ảnh có thuộc danh sách cho phép của adapter (hoặc domain nguồn) không. */
export function isAllowedImageHost(adapter: SourceAdapter, imageUrl: string): boolean {
  let host: string;
  try {
    host = new URL(imageUrl).hostname;
  } catch {
    return false;
  }
  const allowed = [...adapter.imageHosts, new URL(adapter.baseUrl).hostname];
  return allowed.some((h) => host === h || host.endsWith(`.${h}`));
}

export { MangadexAdapter, NettruyenAdapter, TruyenfullAdapter, TruyenqqAdapter, WetruyenAdapter };
