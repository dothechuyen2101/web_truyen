import { Suspense } from "react";
import { prisma } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Panel, inputClass } from "@/components/admin/ui";
import { TimeAgo } from "@/components/time-ago";
import { requireAdmin } from "@/lib/admin";
import { formatNumber } from "@/lib/format";
import { crawlSourceNow, startBackfill, stopBackfill, syncStoryUrl, updateSource } from "../actions";

async function Sources() {
  await requireAdmin("/admin/nguon");
  const sources = await prisma.source.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { stories: true } } },
  });

  return (
    <>
      <AdminHeader
        title="Nguồn crawl"
        description="Đổi domain khi nguồn chuyển nhà, bật/tắt nguồn, chỉnh tốc độ crawl và chạy crawl thủ công."
      />
      <div className="space-y-6">
        {sources.map((s) => (
          <Panel key={s.id}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <Badge color="blue">{s.type === "COMIC" ? "Truyện tranh" : "Truyện chữ"}</Badge>
              {s.enabled ? <Badge color="green">Đang bật</Badge> : <Badge>Đã tắt</Badge>}
              <span className="text-sm text-muted-foreground">
                · {formatNumber(s._count.stories)} truyện · quét lần cuối{" "}
                {s.lastCrawledAt ? <TimeAgo date={s.lastCrawledAt} /> : "chưa bao giờ"}
              </span>
            </div>
            {s.lastError && (
              <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Lỗi gần nhất: {s.lastError}</p>
            )}

            <ActionForm action={updateSource} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-end">
              <input type="hidden" name="id" value={s.id} />
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Domain</span>
                <input name="baseUrl" defaultValue={s.baseUrl} className={`${inputClass} w-full`} required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Ưu tiên</span>
                <input name="priority" type="number" defaultValue={s.priority} className={`${inputClass} w-full`} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Giãn cách (ms)</span>
                <input name="rateLimitMs" type="number" min={100} defaultValue={s.rateLimitMs} className={`${inputClass} w-full`} />
              </label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-4 accent-primary" /> Bật
              </label>
              <SubmitButton variant="default">Lưu</SubmitButton>
            </ActionForm>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
              <ActionForm action={crawlSourceNow} inline>
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton>Quét mới cập nhật ngay</SubmitButton>
              </ActionForm>
              <ActionForm action={startBackfill} inline confirm="Backfill sẽ duyệt toàn bộ danh sách của nguồn (có thể mất nhiều giờ). Tiếp tục?">
                <input type="hidden" name="id" value={s.id} />
                <input name="fromPage" type="number" min={1} defaultValue={1} className={`${inputClass} w-20`} aria-label="Từ trang" />
                <SubmitButton>Backfill toàn bộ</SubmitButton>
              </ActionForm>
              <ActionForm action={stopBackfill} inline>
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton variant="ghost">Dừng backfill</SubmitButton>
              </ActionForm>
              <ActionForm action={syncStoryUrl} inline>
                <input type="hidden" name="id" value={s.id} />
                <input name="url" placeholder="URL truyện trên nguồn" className={`${inputClass} w-64`} required />
                <SubmitButton>Đồng bộ truyện</SubmitButton>
              </ActionForm>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Sources />
    </Suspense>
  );
}
