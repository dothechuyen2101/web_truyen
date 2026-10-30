import { prisma } from "@truyen/db";
import { runCrawlTick } from "@truyen/crawler/tick";

/**
 * Worker cho triển khai trên VPS: chạy đợt crawl định kỳ (cùng hàm với endpoint cron trên Vercel).
 * Không cần Redis — trạng thái nằm trong Postgres.
 */
const INTERVAL_MS = Number(process.env.CRAWL_INTERVAL_MINUTES ?? 15) * 60_000;
/** Mỗi đợt dừng nhận việc mới trước khi tới lượt kế tiếp */
const BUDGET_MS = Math.max(60_000, INTERVAL_MS - 60_000);

let stopping = false;
let wake: (() => void) | undefined;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function main() {
  console.log(`Worker đã chạy — mỗi ${INTERVAL_MS / 60000} phút một đợt crawl`);
  while (!stopping) {
    const startedAt = Date.now();
    try {
      console.log(new Date().toISOString(), "đợt crawl:", JSON.stringify(await runCrawlTick({ budgetMs: BUDGET_MS })));
    } catch (error) {
      console.error(new Date().toISOString(), "đợt crawl lỗi:", error instanceof Error ? error.message : error);
    }
    if (!stopping) await sleep(Math.max(0, INTERVAL_MS - (Date.now() - startedAt)));
  }
  await prisma.$disconnect();
}

function shutdown() {
  console.log("Đang dừng worker…");
  stopping = true;
  wake?.();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void main();
