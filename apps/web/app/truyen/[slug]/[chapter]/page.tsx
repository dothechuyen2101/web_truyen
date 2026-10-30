import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ChapterNav } from "@/components/reader/chapter-nav";
import { ComicReader } from "@/components/reader/comic-reader";
import { ContentErrorBoundary } from "@/components/reader/content-error";
import { NovelReader } from "@/components/reader/novel-reader";
import { ReaderTracker } from "@/components/reader/reader-tracker";
import { ReadingProgress } from "@/components/reader/reading-progress";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { getChapter, getChapterAdIndexes, getChapterBody, getHouseAds, getStory } from "@/lib/data";
import { chapterHref, formatChapterNumber, parseChapterParam } from "@/lib/format";

type Props = PageProps<"/truyen/[slug]/[chapter]">;

async function load(params: Props["params"]) {
  const { slug, chapter } = await params;
  const number = parseChapterParam(chapter);
  if (number === null) return null;
  const story = await getStory(slug);
  if (!story) return null;
  const current = await getChapter(story.id, number);
  return current ? { story, chapter: current } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Không tìm thấy chương" };
  const { story, chapter } = data;
  const name = `Chương ${formatChapterNumber(chapter.number)}${chapter.title ? `: ${chapter.title}` : ""}`;
  return {
    title: `${story.title} - ${name}`,
    description: `Đọc ${story.title} ${name} mới nhất.`,
    alternates: { canonical: chapterHref(story.slug, chapter.number) },
  };
}

async function ChapterBody({ chapterId, title }: { chapterId: number; title: string }) {
  const body = await getChapterBody(chapterId);
  if (body.kind === "text") return <NovelReader html={body.html} />;
  const [adIndexes, houseAds] = await Promise.all([getChapterAdIndexes(chapterId), getHouseAds()]);
  return <ComicReader urls={body.urls} title={title} adIndexes={adIndexes} houseAds={houseAds} seed={chapterId} />;
}

function BodySkeleton() {
  return (
    <div className="space-y-3.5" aria-label="Đang tải nội dung chương">
      <p className="text-center text-sm text-muted-foreground">Đang tải nội dung chương…</p>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${82 + ((i * 7) % 18)}%` }} />
      ))}
    </div>
  );
}

async function ChapterView({ params }: Pick<Props, "params">) {
  const data = await load(params);
  if (!data) notFound();
  const { story, chapter } = data;
  const prevHref = chapter.prev !== null ? chapterHref(story.slug, chapter.prev) : null;
  const nextHref = chapter.next !== null ? chapterHref(story.slug, chapter.next) : null;
  const nav = (
    <ChapterNav storyId={story.id} slug={story.slug} current={chapter.number} prev={chapter.prev} next={chapter.next} />
  );

  return (
    <article>
      <ReadingProgress />
      <header className="mb-6 text-center">
        <Link
          href={`/truyen/${story.slug}`}
          className="group inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {story.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Chương {formatChapterNumber(chapter.number)}
        </h1>
        {chapter.title && <p className="mt-1 text-muted-foreground">{chapter.title}</p>}
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-brand" />
      </header>
      <div className="mb-8">{nav}</div>
      <ContentErrorBoundary>
        <Suspense
          fallback={
            <SkeletonOut>
              <BodySkeleton />
            </SkeletonOut>
          }
        >
          <Reveal>
            <ChapterBody chapterId={chapter.id} title={story.title} />
          </Reveal>
        </Suspense>
      </ContentErrorBoundary>
      <div className="mt-10">{nav}</div>
      <div className="mt-12">
        <CommentSection storyId={story.id} chapterId={chapter.id} />
      </div>
      <ReaderTracker
        storyId={story.id}
        chapterId={chapter.id}
        prevHref={prevHref}
        nextHref={nextHref}
        entry={{
          slug: story.slug,
          title: story.title,
          cover: story.cover,
          type: story.type,
          chapter: chapter.number,
          chapterTitle: chapter.title,
        }}
      />
    </article>
  );
}

export default function ChapterPage(props: Props) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Suspense fallback={<BodySkeleton />}>
          <ChapterView params={props.params} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
