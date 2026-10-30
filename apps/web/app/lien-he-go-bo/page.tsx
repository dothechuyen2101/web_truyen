import type { Metadata } from "next";
import { PageTransition } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { SITE_NAME } from "@/lib/site";
import { TakedownForm } from "./takedown-form";

export const metadata: Metadata = {
  title: "Yêu cầu gỡ nội dung",
  description: `Gửi yêu cầu gỡ nội dung vi phạm bản quyền trên ${SITE_NAME}.`,
};

export default function TakedownPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageTitle
          title="Yêu cầu gỡ nội dung"
          description={`${SITE_NAME} tổng hợp truyện từ nhiều nguồn công khai trên Internet. Nếu bạn là tác giả, nhà xuất bản hoặc người nắm bản quyền và muốn gỡ nội dung, hãy gửi yêu cầu bên dưới.`}
        />
        <TakedownForm />
      </div>
    </PageTransition>
  );
}
