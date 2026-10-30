import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { StoryGridSkeleton } from "@/components/story-card";
import { StoryListing } from "@/components/story-listing";

export const metadata: Metadata = {
  title: "Tìm truyện",
  robots: { index: false },
};

async function SearchResults({ searchParams }: Pick<PageProps<"/tim-kiem">, "searchParams">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!q) {
    return <PageTitle title="Tìm truyện" description="Nhập tên truyện hoặc tác giả vào ô tìm kiếm." />;
  }
  return (
    <>
      <PageTitle title={`Kết quả cho “${q}”`} />
      <StoryListing basePath="/tim-kiem" searchParams={searchParams} fixed={{ q }} />
    </>
  );
}

export default function SearchPage(props: PageProps<"/tim-kiem">) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Suspense
          fallback={
            <SkeletonOut>
              <StoryGridSkeleton count={24} />
            </SkeletonOut>
          }
        >
          <Reveal>
            <SearchResults searchParams={props.searchParams} />
          </Reveal>
        </Suspense>
      </div>
    </PageTransition>
  );
}
