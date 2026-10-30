"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  Activity,
  BookCopy,
  Flag,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Server,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/nguon", label: "Nguồn crawl", icon: Server },
  { href: "/admin/truyen", label: "Truyện", icon: BookCopy },
  { href: "/admin/crawl", label: "Lịch sử crawl", icon: Activity },
  { href: "/admin/binh-luan", label: "Bình luận", icon: MessageSquare },
  { href: "/admin/nguoi-dung", label: "Người dùng", icon: Users },
  { href: "/admin/go-bo", label: "Yêu cầu gỡ", icon: Flag },
  { href: "/admin/quang-cao", label: "Quảng cáo", icon: Megaphone },
];

function NavItems({ pathname }: { pathname: string | null }) {
  return (
    <>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/admin" ? pathname === href : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </>
  );
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

export function AdminNav() {
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0">
      <Suspense fallback={<NavItems pathname={null} />}>
        <ActiveNavItems />
      </Suspense>
    </nav>
  );
}
