import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Kiểm tra CRON_SECRET: Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>"; dịch vụ ngoài có thể dùng ?secret= */
export function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
