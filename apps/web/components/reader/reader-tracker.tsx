"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveHistory, type HistoryEntry } from "@/lib/history";

/**
 * Chạy khi người đọc mở chương: lưu lịch sử đọc, báo lượt xem (kèm tải trước chương sau)
 * và gắn phím ←/→ để chuyển chương.
 */
export function ReaderTracker({
  storyId,
  chapterId,
  entry,
  prevHref,
  nextHref,
}: {
  storyId: number;
  chapterId: number;
  entry: Omit<HistoryEntry, "at">;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    saveHistory({ ...entry, at: Date.now() });
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, chapterId, chapterNumber: entry.chapter }),
      keepalive: true,
    }).catch(() => {});
    // entry là object mới mỗi lần render; chỉ cần chạy lại khi đổi chương.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, chapterId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft" && prevHref) router.push(prevHref);
      if (e.key === "ArrowRight" && nextHref) router.push(nextHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref]);

  return null;
}
