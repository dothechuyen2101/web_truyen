import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@truyen/db";
import { getQueues } from "@truyen/crawler/queue";
import { AdminHeader, AdminSkeleton, Badge, Panel, StatCard, Table, td } from "@/components/admin/ui";
import { TimeAgo } from "@/components/time-ago";
import { hoursAgo, requireAdmin } from "@/lib/admin";
import { formatNumber } from "@/lib/format";

const RUN_STATUS = { SUCCESS: "green", FAILED: "red", RUNNING: "blue" } as const;

async function queueCounts() {
  const queues = getQueues();
  const entries = await Promise.all(
    Object.entries(queues).map(async ([name, q]) => {
      const c = await q.getJobCounts("waiting", "prioritized", "active", "delayed", "failed");
      return [name, { waiting: (c.waiting ?? 0) + (c.prioritized ?? 0), active: c.active ?? 0, delayed: c.delayed ?? 0 }] as const;
    }),
  );
  return entries;
}

async function Dashboard() {
  await requireAdmin("/admin");
  const dayAgo = hoursAgo(24);
  const [novels, comics, hidden, chapters, contents, users, comments, takedowns, failed24h, sources, runs, queues] =
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
      queueCounts().catch(() => null),
    ]);

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
                  </p>
                </div>
                {!s.enabled ? <Badge>Đã tắt</Badge> : s.lastError ? <Badge color="red">Lỗi</Badge> : <Badge color="green">Hoạt động</Badge>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Hàng đợi job" description="Số job đang chờ / đang chạy / hẹn giờ trong Redis.">
          {queues ? (
            <div className="grid grid-cols-3 gap-3">
              {queues.map(([name, c]) => (
                <div key={name} className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-medium capitalize">{name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.waiting} chờ · {c.active} chạy · {c.delayed} hẹn
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-destructive">Không kết nối được Redis.</p>
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
