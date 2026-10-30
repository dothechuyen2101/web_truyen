import type { Metadata } from "next";
import { PageTransition } from "@/components/motion";
import { PushToggle } from "@/components/push-toggle";
import { PageTitle } from "@/components/section";
import { ReadingHistory } from "./reading-history";

export const metadata: Metadata = {
  title: "Tủ truyện",
  robots: { index: false },
};

export default function BookshelfPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageTitle
          title="Tủ truyện"
          description="Lịch sử đọc và truyện bạn theo dõi. Đăng nhập để đồng bộ trên mọi thiết bị."
        />
        <div className="mb-8">
          <PushToggle />
        </div>
        <ReadingHistory />
      </div>
    </PageTransition>
  );
}
