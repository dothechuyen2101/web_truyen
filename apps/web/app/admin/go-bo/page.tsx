import { Suspense } from "react";
import { prisma, type TakedownStatus } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Empty } from "@/components/admin/ui";
import { TimeAgo } from "@/components/time-ago";
import { requireAdmin } from "@/lib/admin";
import { resolveTakedown } from "../actions";

const STATUS = {
  PENDING: { label: "Chờ xử lý", color: "amber" },
  RESOLVED: { label: "Đã gỡ", color: "green" },
  REJECTED: { label: "Từ chối", color: "gray" },
} as const;

async function Takedowns({ searchParams }: Pick<PageProps<"/admin/go-bo">, "searchParams">) {
  await requireAdmin("/admin/go-bo");
  const sp = await searchParams;
  const status = (typeof sp.status === "string" && sp.status in STATUS ? sp.status : "PENDING") as TakedownStatus;
  const requests = await prisma.takedownRequest.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <AdminHeader
        title="Yêu cầu gỡ nội dung"
        description="“Gỡ” sẽ ẩn các truyện có trong danh sách URL (dạng /truyen/<slug>)."
        actions={
          <div className="flex gap-1 rounded-full border p-1 text-sm">
            {(Object.keys(STATUS) as TakedownStatus[]).map((s) => (
              <a key={s} href={`/admin/go-bo?status=${s}`} className={`rounded-full px-3 py-1 ${s === status ? "bg-brand text-white" : ""}`}>
                {STATUS[s].label}
              </a>
            ))}
          </div>
        }
      />
      {requests.length ? (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                  {r.email}
                </a>
                <Badge color={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
                <span className="text-xs text-muted-foreground">
                  <TimeAgo date={r.createdAt} />
                </span>
              </div>
              <pre className="mt-2 rounded-lg bg-muted/60 p-3 font-mono text-xs break-all whitespace-pre-wrap">{r.urls}</pre>
              <p className="mt-2 whitespace-pre-line">{r.message}</p>
              {r.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <ActionForm action={resolveTakedown} inline confirm="Ẩn các truyện trong danh sách và đánh dấu đã xử lý?">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="default" name="decision" value="resolve">
                      Gỡ nội dung
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={resolveTakedown} inline>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="ghost" name="decision" value="reject">
                      Từ chối
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Không có yêu cầu nào.</Empty>
      )}
    </>
  );
}

export default function AdminTakedownPage(props: PageProps<"/admin/go-bo">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Takedowns searchParams={props.searchParams} />
    </Suspense>
  );
}
