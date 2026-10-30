import Link from "next/link";
import { Suspense } from "react";
import { prisma, type Prisma } from "@truyen/db";
import { toSearchText } from "@truyen/shared";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Empty, Table, inputClass, td } from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { requireAdmin } from "@/lib/admin";
import { formatNumber, TYPE_LABEL } from "@/lib/format";
import { proxiedImage } from "@/lib/image-proxy";
import { setStoryHidden } from "../actions";

const PAGE_SIZE = 30;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Stories({ searchParams }: Pick<PageProps<"/admin/truyen">, "searchParams">) {
  await requireAdmin("/admin/truyen");
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const type = first(sp.type);
  const hiddenOnly = first(sp.hidden) === "1";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const where: Prisma.StoryWhereInput = {
    ...(type === "NOVEL" || type === "COMIC" ? { type } : {}),
    ...(hiddenOnly && { hidden: true }),
    ...(q &&
      (/^\d+$/.test(q)
        ? { id: Number(q) }
        : { OR: [{ searchText: { contains: toSearchText(q) } }, { slug: { contains: q } }] })),
  };
  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { sources: true } } },
    }),
    prisma.story.count({ where }),
  ]);

  const href = (p: number) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(type && { type }), ...(hiddenOnly && { hidden: "1" }) });
    if (p > 1) params.set("page", String(p));
    return `/admin/truyen?${params}`;
  };

  return (
    <>
      <AdminHeader title="Truyện" description={`${formatNumber(total)} truyện`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Tên, slug hoặc ID…" className={`${inputClass} w-64`} />
        <select name="type" defaultValue={type} className={inputClass}>
          <option value="">Mọi loại</option>
          <option value="NOVEL">Truyện chữ</option>
          <option value="COMIC">Truyện tranh</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hidden" value="1" defaultChecked={hiddenOnly} className="size-4 accent-primary" /> Chỉ truyện đang ẩn
        </label>
        <button className="h-9 rounded-lg border px-4 text-sm hover:bg-muted">Lọc</button>
      </form>

      {stories.length ? (
        <Table head={["", "Truyện", "Loại", "Chương", "Lượt xem", "Nguồn", "Trạng thái", ""]}>
          {stories.map((s) => (
            <tr key={s.id} className={s.hidden ? "opacity-60" : undefined}>
              <td className={`${td} w-12`}>
                {s.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proxiedImage(s.coverUrl)} alt="" className="h-12 w-9 rounded object-cover" loading="lazy" />
                )}
              </td>
              <td className={`${td} max-w-xs`}>
                <Link href={`/admin/truyen/${s.id}`} className="font-medium hover:text-primary">
                  {s.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  #{s.id} · {s.slug}
                </p>
              </td>
              <td className={td}>{TYPE_LABEL[s.type]}</td>
              <td className={`${td} tabular-nums`}>{formatNumber(s.chapterCount)}</td>
              <td className={`${td} tabular-nums`}>{formatNumber(s.viewCount)}</td>
              <td className={td}>{s._count.sources}</td>
              <td className={td}>{s.hidden ? <Badge color="amber">Đang ẩn</Badge> : <Badge color="green">Hiển thị</Badge>}</td>
              <td className={td}>
                <ActionForm action={setStoryHidden} inline>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="hidden" value={s.hidden ? "0" : "1"} />
                  <SubmitButton variant="ghost">{s.hidden ? "Hiện" : "Ẩn"}</SubmitButton>
                </ActionForm>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>Không có truyện nào khớp bộ lọc.</Empty>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} href={href} />
    </>
  );
}

export default function AdminStoriesPage(props: PageProps<"/admin/truyen">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Stories searchParams={props.searchParams} />
    </Suspense>
  );
}
