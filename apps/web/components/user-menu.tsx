"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";
import { UserAvatar } from "./user-avatar";

/** Đường dẫn trang đăng nhập, quay lại trang hiện tại sau khi đăng nhập xong. */
export function loginHref() {
  return `/dang-nhap?redirect=${encodeURIComponent(location.pathname + location.search)}`;
}

export function UserMenu() {
  const { data, isPending } = useSession();
  const router = useRouter();

  if (isPending) return <div className="skeleton size-9 shrink-0 rounded-full" />;

  if (!data) {
    return (
      <Button
        size="sm"
        className="shrink-0 rounded-full bg-brand shadow-sm shadow-primary/25 hover:opacity-95"
        onClick={() => router.push(loginHref())}
      >
        <LogIn /> <span className="hidden sm:inline">Đăng nhập</span>
      </Button>
    );
  }

  const { user } = data;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="shrink-0 rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Tài khoản"
      >
        <UserAvatar name={user.name} image={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <UserAvatar name={user.name} image={user.image} className="size-10" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/tu-truyen">
            <BookMarked /> Tủ truyện
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> Quản trị
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.refresh();
          }}
        >
          <LogOut /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
