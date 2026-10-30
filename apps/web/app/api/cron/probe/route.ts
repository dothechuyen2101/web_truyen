import type { NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 60;

const MAX_URLS = 25;
const TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

async function probe(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, error: "URL không hợp lệ" };
  }
  if (url.protocol !== "https:") return { url: raw, error: "Chỉ hỗ trợ https" };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
    });
    const type = res.headers.get("content-type") ?? "";
    const head = type.includes("html") ? (await res.text()).slice(0, 50_000) : (await res.body?.cancel(), "");
    return {
      url: raw,
      status: res.status,
      finalUrl: res.url !== url.toString() ? res.url : undefined,
      server: res.headers.get("server"),
      cfMitigated: res.headers.get("cf-mitigated") ?? undefined,
      contentType: type,
      title: head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 100),
      ms: Date.now() - started,
    };
  } catch (error) {
    return { url: raw, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

/**
 * Chẩn đoán: kiểm tra từ chính server này các URL có truy cập được không (nguồn có chặn IP máy chủ không).
 * Chỉ trả mã trạng thái, vài header và tiêu đề trang — không trả nội dung, nên không dùng làm proxy được.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return Response.json({ ok: false }, { status: 401 });
  const urls = request.nextUrl.searchParams.getAll("url").slice(0, MAX_URLS);
  const results = await Promise.all(urls.map(probe));
  return Response.json({ region: process.env.VERCEL_REGION ?? "local", results }, { headers: { "Cache-Control": "no-store" } });
}
