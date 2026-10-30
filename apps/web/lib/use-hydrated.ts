"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false khi render trên server / trước khi hydrate, true khi JavaScript đã chạy trên trình duyệt. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
