"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  ok: boolean;
  message: string;
}

const TOAST_MS = 4500;
const EMPTY: Toast[] = [];
let toasts: Toast[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Hiện thông báo kết quả thao tác — vẫn hiện kể cả khi form vừa gửi đã biến khỏi trang. */
export function toast(message: string, ok = true) {
  const item = { id: nextId++, ok, message };
  toasts = [...toasts, item].slice(-4);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emit();
  }, TOAST_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex animate-in items-start gap-2.5 rounded-xl border bg-popover p-3 text-sm shadow-lg duration-300 fade-in slide-in-from-bottom-2",
            t.ok ? "border-emerald-500/30" : "border-destructive/40",
          )}
        >
          {t.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
