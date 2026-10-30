import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { runCrawlTick } from "@truyen/crawler/tick";

// Đợt crawl chạy nền sau khi đã trả lời; giới hạn của gói Hobby là 300 giây.
export const maxDuration = 300;
/** Ngân sách cho một đợt — chừa thời gian cho truyện đang đồng bộ dở hoàn tất */
const TICK_BUDGET_MS = Number(process.env.CRAWL_TICK_SECONDS ?? 120) * 1000;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>"; dịch vụ ngoài có thể dùng ?secret=
  const given =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Kích hoạt một đợt crawl (thay cho worker chạy liên tục). Gọi bởi Vercel Cron và/hoặc
 * cron-job.org. Trả lời ngay rồi chạy nền, nên bên gọi không phải chờ.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  after(async () => {
    try {
      console.log("Đợt crawl:", JSON.stringify(await runCrawlTick({ budgetMs: TICK_BUDGET_MS })));
    } catch (error) {
      console.error("Đợt crawl lỗi:", error);
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
