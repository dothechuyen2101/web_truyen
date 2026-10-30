import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Các số trang hiển thị quanh trang hiện tại; null là dấu "…" */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = [...new Set([1, pageCount, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1]! > 1 ? [null, p] : [p]));
}

export function Pagination({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const item = "flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-medium transition-all";
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang">
      {page > 1 && (
        <Link href={href(page - 1)} className={cn(item, "bg-card hover:border-primary/60 hover:text-primary")} aria-label="Trang trước">
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {pageWindow(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              item,
              p === page
                ? "border-transparent bg-brand text-white shadow-md shadow-primary/25"
                : "bg-card hover:border-primary/60 hover:text-primary",
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link href={href(page + 1)} className={cn(item, "bg-card hover:border-primary/60 hover:text-primary")} aria-label="Trang sau">
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
