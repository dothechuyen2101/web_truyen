import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Section({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight sm:text-xl">
          {icon && (
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary [&_svg]:size-4.5">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="group flex shrink-0 items-center gap-0.5 rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            Xem tất cả
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="text-brand">{title}</span>
      </h1>
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
    </div>
  );
}
