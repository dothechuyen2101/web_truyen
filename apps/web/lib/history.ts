"use client";

import { useMemo } from "react";
import { useStoredValue, writeStoredValue } from "./use-stored-value";

/** Lịch sử đọc lưu trên trình duyệt (cho cả người chưa đăng nhập). */
export interface HistoryEntry {
  slug: string;
  title: string;
  cover: string | null;
  type: "NOVEL" | "COMIC";
  chapter: number;
  chapterTitle: string | null;
  at: number;
}

const KEY = "reading-history";
const MAX_ENTRIES = 100;

function parse(raw: string | null): HistoryEntry[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readHistory(): HistoryEntry[] {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

/** Lịch sử đọc, `null` khi chưa đọc được (đang render phía server). */
export function useHistory(): HistoryEntry[] | null {
  const raw = useStoredValue(KEY);
  return useMemo(() => (raw === undefined ? null : parse(raw)), [raw]);
}

export function saveHistory(entry: HistoryEntry) {
  const rest = readHistory().filter((e) => e.slug !== entry.slug);
  writeStoredValue(KEY, JSON.stringify([entry, ...rest].slice(0, MAX_ENTRIES)));
}

export function removeHistory(slug: string) {
  writeStoredValue(KEY, JSON.stringify(readHistory().filter((e) => e.slug !== slug)));
}
