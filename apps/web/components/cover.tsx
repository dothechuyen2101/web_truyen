"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ảnh bìa đi qua proxy; dùng <img> thường vì ảnh đã được Cloudflare cache, không cần tối ưu thêm.
 * Lỗi tải (nguồn chập chờn) thì thử lại một lần, vẫn lỗi thì hiện biểu tượng thay thế.
 */
export function Cover({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const failed = !src || attempt > 1;

  return (
    <div className={cn("relative aspect-[3/4] overflow-hidden rounded-md bg-muted", className)}>
      {failed ? (
        <BookOpen className="absolute top-1/2 left-1/2 size-8 -translate-1/2 text-muted-foreground/50" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attempt ? `${src}&retry=${attempt}` : src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setAttempt((a) => a + 1)}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
    </div>
  );
}
