import type { NextRequest } from "next/server";
import { adapterForImage } from "@/lib/sources";
import { verifyImageSignature } from "@/lib/image-proxy";

const UPSTREAM_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Không cache phản hồi lỗi: lỗi nguồn thường chỉ tạm thời, cache lại sẽ giữ ảnh hỏng ở trình duyệt/CDN.
const error = (status: number, message: string) =>
  new Response(message, { status, headers: { "Cache-Control": "no-store" } });

/** Thử lại một lần khi lỗi mạng (socket keep-alive bị đóng, DNS chập chờn); lỗi HTTP thì không thử lại. */
async function fetchImage(url: string, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers,
      });
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

/** Proxy ảnh của nguồn: kiểm tra chữ ký + whitelist host, gắn Referer để qua chặn hotlink. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("u");
  const signature = request.nextUrl.searchParams.get("s");
  if (!url || !signature || !verifyImageSignature(url, signature)) {
    return error(403, "Chữ ký không hợp lệ");
  }

  const adapter = await adapterForImage(url);
  if (!adapter) return error(403, "Host ảnh không được phép");

  let upstream: Response;
  try {
    upstream = await fetchImage(url, {
      "User-Agent": USER_AGENT,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...adapter.imageHeaders(url),
    });
  } catch {
    return error(504, "Nguồn ảnh không phản hồi");
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || !contentType.startsWith("image/")) {
    await upstream.body?.cancel();
    return error(502, "Không tải được ảnh từ nguồn");
  }

  const headers = new Headers({
    "Content-Type": contentType,
    // s-maxage: CDN (Vercel, Cloudflare) cũng cache — Vercel chỉ cache phản hồi function khi có s-maxage.
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { headers });
}
