"use client";

import { useRouter } from "next/navigation";
import { Component, startTransition, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function ContentErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="animate-in rounded-2xl border border-dashed p-8 text-center duration-300 fade-in">
      <p className="font-medium">Không tải được nội dung chương.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nguồn truyện đang chậm hoặc tạm thời lỗi. Bạn thử lại sau ít giây nhé.
      </p>
      <Button className="mt-4 rounded-full" variant="outline" onClick={onRetry}>
        <RotateCw /> Thử lại
      </Button>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; onRetry: (reset: () => void) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ContentErrorFallback onRetry={() => this.props.onRetry(() => this.setState({ failed: false }))} />;
  }
}

/**
 * Bắt lỗi khi tải nội dung chương (nguồn chậm/lỗi). "Thử lại" render lại dữ liệu server rồi xoá trạng thái lỗi.
 * Tự viết thay vì dùng catchError của next/error vì bản Next hiện tại lỗi khi nạp module đó.
 */
export function ContentErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Boundary
      onRetry={(reset) =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    >
      {children}
    </Boundary>
  );
}
