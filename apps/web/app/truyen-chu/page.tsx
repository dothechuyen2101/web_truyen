import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { StoryGridSkeleton } from "@/components/story-card";
import { StoryListing } from "@/components/story-listing";

export const metadata: Metadata = {
  title: "Truyện chữ",
  description: "Tiểu thuyết, ngôn tình, tiên hiệp, kiếm hiệp… cập nhật chương mới mỗi ngày.",
  alternates: { canonical: "/truyen-chu" },
};

export default function Page(props: PageProps<"/truyen-chu">) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageTitle title="Truyện chữ" description="Tiểu thuyết, ngôn tình, tiên hiệp, kiếm hiệp… cập nhật chương mới mỗi ngày." />
        <Suspense
          fallback={
            <SkeletonOut>
              <StoryGridSkeleton count={24} />
            </SkeletonOut>
          }
        >
          <Reveal>
            <StoryListing basePath="/truyen-chu" searchParams={props.searchParams} fixed={{ type: "NOVEL" }} />
          </Reveal>
        </Suspense>
      </div>
    </PageTransition>
  );
}
