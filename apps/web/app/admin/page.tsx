import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@truyen/db";
import { AdminHeader, AdminSkeleton, Badge, Panel, StatCard, Table, td } from "@/components/admin/ui";
import { TimeAgo } from "@/components/time-ago";
import { hoursAgo, requireAdmin } from "@/lib/admin";
import { formatNumber } from "@/lib/format";

const RUN_STATUS = { SUCCESS: "green", FAILED: "red", RUNNING: "blue" } as const;

async function Dashboard() {
  await requireAdmin("/admin");
  const dayAgo = hoursAgo(24);
  const [novels, comics, hidden, chapters, contents, users, comments, takedowns, failed24h, sources, runs, lastTick] =
    await Promise.all([
      prisma.story.count({ where: { type: "NOVEL" } }),
      prisma.story.count({ where: { type: "COMIC" } }),
      prisma.story.count({ where: { hidden: true } }),
      prisma.chapter.count(),
      prisma.chapterContent.count(),
      prisma.user.count(),
      prisma.comment.count({ where: { hidden: false } }),
      prisma.takedownRequest.count({ where: { status: "PENDING" } }),
      prisma.crawlRun.count({ where: { status: "FAILED", startedAt: { gte: dayAgo } } }),
      prisma.source.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { stories: true } } } }),
      prisma.crawlRun.findMany({ orderBy: { startedAt: "desc" }, take: 8, include: { source: { select: { name: true } } } }),
      prisma.crawlRun.findFirst({ where: { job: "tick" }, orderBy: { startedAt: "desc" } }),
    ]);
  const tickStats = lastTick?.stats as Record<string, number> | null;

  return (
    <>
      <AdminHeader title="Tổng quan" description="Tình trạng kho truyện, crawler và người dùng." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Truyện chữ" value={formatNumber(novels)} href="/admin/truyen?type=NOVEL" />
        <StatCard label="Truyện tranh" value={formatNumber(comics)} href="/admin/truyen?type=COMIC" />
        <StatCard label="Chương" value={formatNumber(chapters)} hint={`${formatNumber(contents)} chương đã có nội dung`} />
        <StatCard label="Truyện đang ẩn" value={formatNumber(hidden)} href="/admin/truyen?hidden=1" />
        <StatCard label="Người dùng" value={formatNumber(users)} href="/admin/nguoi-dung" />
        <StatCard label="Bình luận" value={formatNumber(comments)} href="/admin/binh-luan" />
        <StatCard label="Yêu cầu gỡ chờ xử lý" value={formatNumber(takedowns)} href="/admin/go-bo" />
        <StatCard label="Job crawl lỗi (24h)" value={formatNumber(failed24h)} href="/admin/crawl?status=FAILED" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Nguồn crawl">
          <ul className="divide-y">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href="/admin/nguon" className="font-medium hover:text-primary">
                    {s.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatNumber(s._count.stories)} truyện · quét lần cuối{" "}
                    {s.lastCrawledAt ? <TimeAgo date={s.lastCrawledAt} /> : "chưa bao giờ"}
                    {s.backfillPage !== null && ` · backfill tới trang ${s.backfillPage}`}
                  </p>
                </div>
                {!s.enabled ? <Badge>Đã tắt</Badge> : s.lastError ? <Badge color="red">Lỗi</Badge> : <Badge color="green">Hoạt động</Badge>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Đợt crawl gần nhất" description="Chạy theo lịch qua /api/cron/crawl (Vercel Cron, cron-job.org) hoặc worker trên VPS.">
          {lastTick ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Badge color={RUN_STATUS[lastTick.status]}>{lastTick.status}</Badge>
                <TimeAgo date={lastTick.startedAt} className="text-muted-foreground" />
              </p>
              {tickStats && (
                <p className="text-muted-foreground">
                  Quét {tickStats.checked ?? 0} truyện · đồng bộ {tickStats.synced ?? 0} · lỗi {tickStats.failed ?? 0} · backfill{" "}
                  {tickStats.backfillPages ?? 0} trang · kiểm tra quảng cáo {tickStats.adChecks ?? 0} chương ·{" "}
                  {Math.round((tickStats.durationMs ?? 0) / 1000)} giây
                </p>
              )}
              {lastTick.error && <p className="text-destructive">{lastTick.error}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có đợt crawl nào — kiểm tra cấu hình cron.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Crawl gần đây</h2>
          <Link href="/admin/crawl" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <Table head={["Thời gian", "Nguồn", "Job", "Đối tượng", "Trạng thái"]}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <TimeAgo date={r.startedAt} className="text-muted-foreground" />
              </td>
              <td className={td}>{r.source?.name ?? "—"}</td>
              <td className={td}>{r.job}</td>
              <td className={`${td} max-w-xs truncate`}>{r.target ?? "—"}</td>
              <td className={td}>
                <Badge color={RUN_STATUS[r.status]}>{r.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
