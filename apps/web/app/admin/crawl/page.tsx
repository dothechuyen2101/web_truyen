import { Suspense } from "react";
import { prisma, type CrawlStatus, type Prisma } from "@truyen/db";
import { AdminHeader, AdminSkeleton, Badge, Empty, Table, inputClass, td } from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { TimeAgo } from "@/components/time-ago";
import { requireAdmin } from "@/lib/admin";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 50;
const STATUS_COLOR = { SUCCESS: "green", FAILED: "red", RUNNING: "blue" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function duration(start: Date, end: Date | null) {
  if (!end) return "—";
  const ms = end.getTime() - start.getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function CrawlRuns({ searchParams }: Pick<PageProps<"/admin/crawl">, "searchParams">) {
  await requireAdmin("/admin/crawl");
  const sp = await searchParams;
  const status = first(sp.status) as CrawlStatus | "";
  const job = first(sp.job);
  const sourceId = Number(first(sp.source)) || undefined;
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const where: Prisma.CrawlRunWhereInput = {
    ...(status && { status }),
    ...(job && { job }),
    ...(sourceId && { sourceId }),
  };
  const [runs, total, sources] = await Promise.all([
    prisma.crawlRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { source: { select: { name: true } } },
    }),
    prisma.crawlRun.count({ where }),
    prisma.source.findMany({ select: { id: true, name: true } }),
  ]);

  const href = (p: number) => {
    const params = new URLSearchParams({
      ...(status && { status }),
      ...(job && { job }),
      ...(sourceId && { source: String(sourceId) }),
    });
    if (p > 1) params.set("page", String(p));
    return `/admin/crawl?${params}`;
  };

  return (
    <>
      <AdminHeader title="Lịch sử crawl" description={`${formatNumber(total)} lần chạy (giữ 30 ngày)`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={status} className={inputClass}>
          <option value="">Mọi trạng thái</option>
          <option value="SUCCESS">Thành công</option>
          <option value="FAILED">Lỗi</option>
          <option value="RUNNING">Đang chạy</option>
        </select>
        <select name="job" defaultValue={job} className={inputClass}>
          <option value="">Mọi job</option>
          <option value="discovery">discovery</option>
          <option value="backfill">backfill</option>
          <option value="syncStory">syncStory</option>
        </select>
        <select name="source" defaultValue={sourceId ?? ""} className={inputClass}>
          <option value="">Mọi nguồn</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="h-9 rounded-lg border px-4 text-sm hover:bg-muted">Lọc</button>
      </form>
      {runs.length ? (
        <Table head={["Thời gian", "Nguồn", "Job", "Đối tượng", "Thời lượng", "Trạng thái", "Kết quả"]}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                <TimeAgo date={r.startedAt} />
              </td>
              <td className={td}>{r.source?.name ?? "—"}</td>
              <td className={td}>{r.job}</td>
              <td className={`${td} max-w-[16rem] truncate`} title={r.target ?? undefined}>
                {r.target ?? "—"}
              </td>
              <td className={`${td} tabular-nums`}>{duration(r.startedAt, r.finishedAt)}</td>
              <td className={td}>
                <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              </td>
              <td className={`${td} max-w-[22rem] truncate font-mono text-xs`} title={r.error ?? JSON.stringify(r.stats)}>
                {r.error ? <span className="text-destructive">{r.error}</span> : r.stats ? JSON.stringify(r.stats) : ""}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>Chưa có lần crawl nào khớp bộ lọc.</Empty>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} href={href} />
    </>
  );
}

export default function AdminCrawlPage(props: PageProps<"/admin/crawl">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <CrawlRuns searchParams={props.searchParams} />
    </Suspense>
  );
}
