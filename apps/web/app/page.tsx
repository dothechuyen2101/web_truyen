import { BookText, CheckCircle2, Flame, Image as ImageIcon } from "lucide-react";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { GenreChips } from "@/components/genre-chips";
import { PageTransition } from "@/components/motion";
import { RankingList } from "@/components/ranking-list";
import { Section } from "@/components/section";
import { StoryGrid } from "@/components/story-card";
import { getFeatured, getGenres, listStories } from "@/lib/data";

export default async function Home() {
  const [featured, genres, comics, novels, completed, hot] = await Promise.all([
    getFeatured(),
    getGenres(),
    listStories({ type: "COMIC", sort: "updated", limit: 12 }),
    listStories({ type: "NOVEL", sort: "updated", limit: 12 }),
    listStories({ status: "COMPLETED", sort: "views", limit: 12 }),
    listStories({ sort: "views", limit: 10 }),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <FeaturedCarousel items={featured} />
        <GenreChips genres={genres.slice(0, 24)} />
        <div className="gap-10 lg:grid lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-12">
            <Section title="Truyện tranh mới cập nhật" icon={<ImageIcon />} href="/truyen-tranh">
              <StoryGrid stories={comics.items} />
            </Section>
            <Section title="Truyện chữ mới cập nhật" icon={<BookText />} href="/truyen-chu">
              <StoryGrid stories={novels.items} />
            </Section>
            <Section title="Truyện đã hoàn thành" icon={<CheckCircle2 />} href="/truyen-chu?status=full">
              <StoryGrid stories={completed.items} showType />
            </Section>
          </div>
          <aside className="mt-12 lg:mt-0">
            <div className="rounded-2xl border bg-card p-4 lg:sticky lg:top-24">
              <Section title="Xem nhiều" icon={<Flame />}>
                <RankingList stories={hot.items} />
              </Section>
            </div>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
