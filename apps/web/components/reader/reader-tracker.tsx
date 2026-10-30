"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveHistory, type HistoryEntry } from "@/lib/history";

/** Mỗi truyện chỉ tính một lượt xem trong khoảng này trên một trình duyệt */
const VIEW_DEDUPE_MS = 30 * 60 * 1000;
const VIEWED_KEY = "viewed-stories";

/** true nếu nên tính lượt xem cho truyện này (và ghi nhận thời điểm). */
function shouldCountView(storyId: number) {
  try {
    const viewed: Record<string, number> = JSON.parse(localStorage.getItem(VIEWED_KEY) ?? "{}");
    const now = Date.now();
    if (now - (viewed[storyId] ?? 0) < VIEW_DEDUPE_MS) return false;
    // Dọn mục cũ để localStorage không phình ra.
    for (const [id, at] of Object.entries(viewed)) if (now - at > VIEW_DEDUPE_MS) delete viewed[id];
    viewed[storyId] = now;
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
    return true;
  } catch {
    return true;
  }
}

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
      body: JSON.stringify({
        storyId,
        chapterId,
        chapterNumber: entry.chapter,
        countView: shouldCountView(storyId),
      }),
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
