import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "@/components/admin/toaster";

export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s | Quản trị" },
  robots: { index: false, follow: false },
};

// Layout chỉ là khung giao diện; mỗi trang tự gọi requireAdmin vì layout không chạy lại khi điều hướng.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-7xl gap-8 px-4 py-6 lg:grid lg:grid-cols-[210px_1fr]">
      <aside className="mb-6 lg:mb-0">
        <p className="mb-3 hidden px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase lg:block">
          Quản trị
        </p>
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
      <Toaster />
    </div>
  );
}
