import Link from "next/link";
import type { StoryType } from "@truyen/db";
import { listStories, SORTS, type ListParams, type SortKey } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";
import { StoryGrid } from "./story-card";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_FILTERS = [
  { value: undefined, label: "Tất cả" },
  { value: "ongoing", label: "Đang ra" },
  { value: "full", label: "Hoàn thành" },
] as const;

const TYPE_FILTERS = [
  { value: undefined, label: "Tất cả" },
  { value: "chu", label: "Truyện chữ" },
  { value: "tranh", label: "Truyện tranh" },
] as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function FilterLinks<T extends string | undefined>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  current: T;
  href: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      {options.map((o) => (
        <Link
          key={o.label}
          href={href(o.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-all",
            o.value === current
              ? "border-transparent bg-brand text-white shadow-sm shadow-primary/25"
              : "bg-background hover:border-primary/60 hover:text-primary",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Danh sách truyện có bộ lọc trên URL (?sort=&status=&type=&page=).
 * `fixed` là điều kiện cố định của trang (vd loại truyện, thể loại, từ khoá tìm kiếm).
 */
export async function StoryListing({
  basePath,
  searchParams,
  fixed = {},
}: {
  basePath: string;
  searchParams: Promise<SearchParams>;
  fixed?: Pick<ListParams, "type" | "genre" | "q">;
}) {
  const sp = await searchParams;
  const sortParam = first(sp.sort);
  const sort = sortParam && sortParam in SORTS ? (sortParam as SortKey) : undefined;
  const statusParam = first(sp.status) as "ongoing" | "full" | undefined;
  const typeParam = first(sp.type) as "chu" | "tranh" | undefined;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const type: StoryType | undefined =
    fixed.type ?? (typeParam === "chu" ? "NOVEL" : typeParam === "tranh" ? "COMIC" : undefined);

  const data = await listStories({
    ...fixed,
    type,
    sort,
    status: statusParam === "full" ? "COMPLETED" : statusParam === "ongoing" ? "ONGOING" : undefined,
    page,
  });

  // Giữ nguyên các tham số khác khi đổi một bộ lọc; đổi bộ lọc thì về trang 1.
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: first(sp.q), sort: sortParam, status: statusParam, type: typeParam, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const sortOptions = (Object.keys(SORTS) as SortKey[]).map((k) => ({ value: k, label: SORTS[k] }));
  return (
    <>
      <div className="mb-6 space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <FilterLinks
          label="Sắp xếp"
          options={sortOptions}
          current={sort ?? (fixed.q ? "views" : "updated")}
          href={(v) => href({ sort: v, page: undefined })}
        />
        {!fixed.type && (
          <FilterLinks
            label="Loại"
            options={TYPE_FILTERS}
            current={typeParam}
            href={(v) => href({ type: v, page: undefined })}
          />
        )}
        <FilterLinks
          label="Trạng thái"
          options={STATUS_FILTERS}
          current={statusParam}
          href={(v) => href({ status: v, page: undefined })}
        />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{data.total.toLocaleString("vi-VN")} truyện</p>
      <StoryGrid stories={data.items} showType={!type} />
      <Pagination page={data.page} pageCount={data.pageCount} href={(p) => href({ page: p > 1 ? String(p) : undefined })} />
    </>
  );
}
