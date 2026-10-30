import type { NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 60;

const MAX_URLS = 25;
/** Chỉ các API công khai này mới được trả nội dung (?body=1) — để đọc tài liệu/dữ liệu mẫu khi máy dev không truy cập được */
const BODY_HOSTS = new Set(["api.mangadex.org"]);
const MAX_BODY = 300_000;
const TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

async function probe(raw: string, withBody: boolean) {
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
    const showBody = withBody && BODY_HOSTS.has(url.hostname);
    const text = type.includes("html") || showBody ? await res.text() : (await res.body?.cancel(), "");
    const head = text.slice(0, 50_000);
    return {
      url: raw,
      status: res.status,
      finalUrl: res.url !== url.toString() ? res.url : undefined,
      server: res.headers.get("server"),
      cfMitigated: res.headers.get("cf-mitigated") ?? undefined,
      contentType: type,
      title: head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 100),
      ms: Date.now() - started,
      body: showBody ? text.slice(0, MAX_BODY) : undefined,
    };
  } catch (error) {
    return { url: raw, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

/**
 * Chẩn đoán: kiểm tra từ chính server này các URL có truy cập được không (nguồn có chặn IP máy chủ không).
 * Chỉ trả mã trạng thái, vài header và tiêu đề trang; nội dung chỉ trả cho vài API công khai (BODY_HOSTS),
 * nên không dùng làm proxy được.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return Response.json({ ok: false }, { status: 401 });
  const urls = request.nextUrl.searchParams.getAll("url").slice(0, MAX_URLS);
  const withBody = request.nextUrl.searchParams.get("body") === "1";
  const results = await Promise.all(urls.map((u) => probe(u, withBody)));
  return Response.json({ region: process.env.VERCEL_REGION ?? "local", results }, { headers: { "Cache-Control": "no-store" } });
}
