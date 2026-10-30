"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_PX = 168;

/** Đoạn HTML dài được thu gọn, có nút "Xem thêm". HTML đầu vào đã được làm sạch ở crawler. */
export function ExpandableHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Đo chiều cao thật của nội dung (cập nhật khi đổi cỡ màn hình) để animate max-height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setFullHeight(el.scrollHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overflowing = fullHeight !== null && fullHeight > COLLAPSED_PX + 24;
  const collapsed = overflowing && !expanded;
  return (
    <div>
      <div
        className={cn("relative overflow-hidden transition-[max-height] duration-500 ease-in-out", className)}
        style={{ maxHeight: fullHeight === null || collapsed ? COLLAPSED_PX : fullHeight }}
      >
        <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {overflowing && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
          <ChevronDown className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
