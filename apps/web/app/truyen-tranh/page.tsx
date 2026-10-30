import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { StoryGridSkeleton } from "@/components/story-card";
import { StoryListing } from "@/components/story-listing";

export const metadata: Metadata = {
  title: "Truyện Tranh Online - Manga, Manhwa, Manhua Tiếng Việt",
  description: "Đọc truyện tranh online miễn phí: manga, manhwa, manhua tiếng Việt, truyện màu, cập nhật chap mới mỗi ngày.",
  alternates: { canonical: "/truyen-tranh" },
};

export default function Page(props: PageProps<"/truyen-tranh">) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageTitle title="Truyện tranh" description="Manga, manhwa, manhua, truyện màu cập nhật liên tục." />
        <Suspense
          fallback={
            <SkeletonOut>
              <StoryGridSkeleton count={24} />
            </SkeletonOut>
          }
        >
          <Reveal>
            <StoryListing basePath="/truyen-tranh" searchParams={props.searchParams} fixed={{ type: "COMIC" }} />
          </Reveal>
        </Suspense>
      </div>
    </PageTransition>
  );
}
