import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { StoryGridSkeleton } from "@/components/story-card";
import { StoryListing } from "@/components/story-listing";
import { getGenre } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/the-loai/[slug]">): Promise<Metadata> {
  const genre = await getGenre((await params).slug);
  if (!genre) return { title: "Không tìm thấy thể loại" };
  return {
    title: `Truyện ${genre.name}`,
    description: `Danh sách truyện thể loại ${genre.name} hay, cập nhật mới nhất.`,
    alternates: { canonical: `/the-loai/${genre.slug}` },
  };
}

async function GenreView({ params, searchParams }: PageProps<"/the-loai/[slug]">) {
  const genre = await getGenre((await params).slug);
  if (!genre) notFound();
  return (
    <>
      <PageTitle title={`Thể loại: ${genre.name}`} />
      <StoryListing basePath={`/the-loai/${genre.slug}`} searchParams={searchParams} fixed={{ genre: genre.slug }} />
    </>
  );
}

export default function GenrePage(props: PageProps<"/the-loai/[slug]">) {
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
            <GenreView {...props} />
          </Reveal>
        </Suspense>
      </div>
    </PageTransition>
  );
}
