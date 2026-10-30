"use client";

import { useSyncExternalStore } from "react";

// Sự kiện "storage" chỉ báo thay đổi từ tab khác; tự phát sự kiện này cho thay đổi trong cùng tab.
const LOCAL_EVENT = "local-storage-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_EVENT, callback);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Giá trị thô trong localStorage; `undefined` khi đang render phía server (chưa biết). */
export function useStoredValue(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined,
  );
}

export function writeStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
