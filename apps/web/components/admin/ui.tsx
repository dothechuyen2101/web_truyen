import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      {title && <h2 className="font-semibold">{title}</h2>}
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className={cn(title && "mt-4")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const className = "block rounded-2xl border bg-card p-4 transition-colors";
  return href ? (
    <Link href={href} className={cn(className, "hover:border-primary/50")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

const BADGE = {
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  red: "bg-red-500/12 text-red-700 dark:text-red-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  blue: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  gray: "bg-muted text-muted-foreground",
} as const;

export function Badge({ color = "gray", children }: { color?: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", BADGE[color])}>
      {children}
    </span>
  );
}

/** Bảng cuộn ngang được trên màn hình nhỏ. */
export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-3 py-2.5 align-middle";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export const inputClass =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function AdminSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
