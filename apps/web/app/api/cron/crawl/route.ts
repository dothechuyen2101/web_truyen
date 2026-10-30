import { after, type NextRequest } from "next/server";
import { runCrawlTick } from "@truyen/crawler/tick";
import { cronAuthorized } from "@/lib/cron-auth";

// Đợt crawl chạy nền sau khi đã trả lời; giới hạn của gói Hobby là 300 giây.
export const maxDuration = 300;
/** Ngân sách cho một đợt — chừa thời gian cho truyện đang đồng bộ dở hoàn tất */
const TICK_BUDGET_MS = Number(process.env.CRAWL_TICK_SECONDS ?? 120) * 1000;

/**
 * Kích hoạt một đợt crawl (thay cho worker chạy liên tục). Gọi bởi Vercel Cron và/hoặc
 * cron-job.org. Trả lời ngay rồi chạy nền, nên bên gọi không phải chờ.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return Response.json({ ok: false }, { status: 401 });
  after(async () => {
    try {
      console.log("Đợt crawl:", JSON.stringify(await runCrawlTick({ budgetMs: TICK_BUDGET_MS })));
    } catch (error) {
      console.error("Đợt crawl lỗi:", error);
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
