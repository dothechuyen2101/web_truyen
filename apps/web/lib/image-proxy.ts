import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.IMAGE_PROXY_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("IMAGE_PROXY_SECRET chưa được cấu hình");
  }
  return value ?? "dev-image-secret";
}

function sign(url: string) {
  return createHmac("sha256", secret()).update(url).digest("base64url").slice(0, 22);
}

/** URL ảnh đi qua /api/img (gắn Referer của nguồn, Cloudflare cache lại). */
export function proxiedImage(url: string): string;
export function proxiedImage(url: string | null | undefined): string | null;
export function proxiedImage(url: string | null | undefined) {
  if (!url) return null;
  return `/api/img?u=${encodeURIComponent(url)}&s=${sign(url)}`;
}

export function verifyImageSignature(url: string, signature: string) {
  const expected = Buffer.from(sign(url));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
