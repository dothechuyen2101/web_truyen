import { ViewTransition } from "react";

/** Nội dung trang mờ dần + trượt nhẹ khi chuyển trang (CSS: class "page" trong globals.css). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}

/** Nội dung trong Suspense trượt lên khi tải xong. */
export function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="slide-up" default="none">
      {children}
    </ViewTransition>
  );
}

/** Khung xương (fallback của Suspense) mờ đi khi nội dung thật xuất hiện. */
export function SkeletonOut({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition exit="skeleton-out" default="none">
      {children}
    </ViewTransition>
  );
}
