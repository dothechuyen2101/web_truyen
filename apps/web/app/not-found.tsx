import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md animate-in flex-col items-center px-4 py-24 text-center duration-500 fade-in zoom-in-95">
      <span className="grid size-20 place-items-center rounded-3xl bg-brand text-white shadow-xl shadow-primary/30">
        <SearchX className="size-10" />
      </span>
      <p className="mt-6 text-6xl font-extrabold tracking-tight">
        <span className="text-brand">404</span>
      </p>
      <h1 className="mt-3 text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-2 text-muted-foreground">
        Truyện hoặc chương bạn tìm có thể đã bị gỡ hoặc chưa được cập nhật.
      </p>
      <Button asChild className="mt-6 rounded-full bg-brand">
        <Link href="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
