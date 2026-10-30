"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

interface NavLinksProps {
  className?: string;
  mobile?: boolean;
}

function NavLinksView({ className, mobile, pathname }: NavLinksProps & { pathname: string | null }) {
  return (
    <nav className={className}>
      {NAV_LINKS.map((l) => {
        const active = pathname !== null && (pathname === l.href || pathname.startsWith(`${l.href}/`));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              mobile && "py-1",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavLinks(props: NavLinksProps) {
  return <NavLinksView {...props} pathname={usePathname()} />;
}

/** Đường dẫn hiện tại là dữ liệu URL nên phải đọc trong Suspense; fallback là menu chưa đánh dấu mục đang mở. */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavLinksView {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}
