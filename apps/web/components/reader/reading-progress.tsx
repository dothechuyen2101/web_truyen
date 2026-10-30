"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SHOW_BACK_TO_TOP_AFTER = 800;

/** Thanh tiến độ đọc trên đỉnh trang + nút lên đầu trang. */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const progress = max > 0 ? Math.min(1, root.scrollTop / max) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      setShowTop(root.scrollTop > SHOW_BACK_TO_TOP_AFTER);
    };
    // Gom các sự kiện cuộn vào một khung hình để không cập nhật dồn dập.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 h-1" aria-hidden>
        <div ref={bar} className="h-full origin-left scale-x-0 bg-brand shadow-[0_0_12px] shadow-primary/50" />
      </div>
      <button
        onClick={() => window.scrollTo({ top: 0 })}
        aria-label="Lên đầu trang"
        className={cn(
          "fixed right-4 bottom-6 z-40 grid size-11 place-items-center rounded-full bg-brand text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 sm:right-8",
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <ArrowUp className="size-5" />
      </button>
    </>
  );
}
