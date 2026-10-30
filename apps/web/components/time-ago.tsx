"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(callback: () => void) {
  const timer = setInterval(callback, MINUTE);
  return () => clearInterval(timer);
}

// Số phút hiện tại — giá trị ổn định trong một phút nên không gây render lại liên tục.
const nowMinute = () => Math.floor(Date.now() / MINUTE);

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function relative(date: Date, minute: number) {
  const minutes = Math.max(0, minute - Math.floor(date.getTime() / MINUTE));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return dateFormat.format(date);
}

/**
 * Thời gian tương đối ("2 giờ trước"), tính ở trình duyệt vì trang được cache phía server.
 * Khi render trên server hiển thị ngày tuyệt đối.
 */
export function TimeAgo({ date, className }: { date: Date | string; className?: string }) {
  const d = new Date(date);
  const minute = useSyncExternalStore(subscribe, nowMinute, () => null);
  return (
    <time dateTime={d.toISOString()} className={className}>
      {minute === null ? dateFormat.format(d) : relative(d, minute)}
    </time>
  );
}
