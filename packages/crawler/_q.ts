import { prisma } from "@truyen/db";

// Chờ đợt crawl kết thúc rồi xem kết quả theo nguồn.
await new Promise((r) => setTimeout(r, 15_000));
for (let i = 0; i < 50; i++) {
  const lock = await prisma.crawlLock.findUnique({ where: { name: "tick" } });
  if (!lock || lock.lockedUntil < new Date()) break;
  await new Promise((r) => setTimeout(r, 5000));
}
const tick = await prisma.crawlRun.findFirst({ where: { job: "tick" }, orderBy: { startedAt: "desc" } });
console.log("tick:", tick?.status, JSON.stringify(tick?.stats), tick?.error ?? "");
for (const key of ["mangadex", "manhuavn"]) {
  const src = await prisma.source.findUniqueOrThrow({ where: { key } });
  const since = tick?.startedAt ?? new Date(Date.now() - 600_000);
  const runs = await prisma.crawlRun.groupBy({ by: ["job", "status"], where: { sourceId: src.id, startedAt: { gte: since } }, _count: true });
  const failed = await prisma.crawlRun.findMany({
    where: { sourceId: src.id, startedAt: { gte: since }, status: "FAILED" },
    take: 3,
    select: { target: true, error: true },
  });
  const links = await prisma.storySource.aggregate({ where: { sourceId: src.id }, _count: true, _sum: { chapterCount: true } });
  console.log(`\n${key}: lastError=${src.lastError} backfillPage=${src.backfillPage}`);
  console.log("  runs:", runs.map((r) => `${r.job}/${r.status}=${r._count}`).join(", "));
  console.log("  failed:", failed);
  console.log("  stories:", links._count, "chapters:", links._sum.chapterCount);
}
const mv = await prisma.source.findUniqueOrThrow({ where: { key: "manhuavn" } });
const sample = await prisma.storySource.findMany({
  where: { sourceId: mv.id },
  take: 6,
  orderBy: { id: "desc" },
  select: { chapterCount: true, latestChapterNumber: true, story: { select: { slug: true, title: true } } },
});
console.log("\nmanhuavn sample (đọc được / mới nhất):");
for (const s of sample) console.log(`  ${s.chapterCount}/${s.latestChapterNumber}  ${s.story.title}  (/truyen/${s.story.slug})`);
const manhua = await prisma.story.count({
  where: { genres: { some: { genre: { slug: "manhua" } } }, sources: { some: { source: { enabled: true }, chapterCount: { gt: 0 } } } },
});
console.log("\nreadable manhua stories now:", manhua);
await prisma.$disconnect();
