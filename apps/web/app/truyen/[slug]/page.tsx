import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Activity, ArrowDownUp, BookOpen, Clock, Eye, ListOrdered, PenLine, Sparkles } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContinueReading } from "@/components/continue-reading";
import { Cover } from "@/components/cover";
import { ExpandableHtml } from "@/components/expandable-html";
import { PageTransition, Reveal, SkeletonOut } from "@/components/motion";
import { StoryInteractions } from "@/components/story-interactions";
import { Pagination } from "@/components/pagination";
import { TimeAgo } from "@/components/time-ago";
import { Button } from "@/components/ui/button";
import { getChapterPage, getStory, type StoryDetail } from "@/lib/data";
import {
  chapterHref,
  formatChapterNumber,
  formatNumber,
  STATUS_LABEL,
  stripHtml,
  TYPE_LABEL,
} from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/truyen/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return { title: "Không tìm thấy truyện" };
  const description =
    stripHtml(story.description).slice(0, 160) ||
    `Đọc ${TYPE_LABEL[story.type].toLowerCase()} ${story.title} online, cập nhật chương mới nhất.`;
  return {
    title: `${story.title} [${TYPE_LABEL[story.type]}]`,
    description,
    alternates: { canonical: `/truyen/${slug}` },
    openGraph: { title: story.title, description, images: story.cover ? [story.cover] : undefined },
  };
}

function Stat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/70 px-3 py-2.5 backdrop-blur">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary [&_svg]:size-4.5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{children}</p>
      </div>
    </div>
  );
}

function StoryHeader({ story }: { story: StoryDetail }) {
  return (
    <div className="relative">
      {/* Nền mờ lấy từ ảnh bìa */}
      {story.cover && (
        <div aria-hidden className="pointer-events-none absolute -top-6 left-1/2 -z-10 h-[440px] w-screen -translate-x-1/2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.cover} alt="" className="size-full scale-110 object-cover opacity-40 blur-3xl saturate-150 dark:opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>
      )}
      <div className="flex flex-col gap-8 pt-4 sm:flex-row">
        <Cover
          src={story.cover}
          alt={story.title}
          eager
          className="mx-auto w-48 shrink-0 rounded-2xl shadow-2xl ring-1 ring-border sm:mx-0 sm:w-56"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
              {TYPE_LABEL[story.type]}
            </span>
            {story.genres.map((g) => (
              <Link
                key={g.slug}
                href={`/the-loai/${g.slug}`}
                className="rounded-full border bg-background/60 px-2.5 py-0.5 text-xs backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
              >
                {g.name}
              </Link>
            ))}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{story.title}</h1>
          {story.altTitles.length > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground">{story.altTitles.join(" · ")}</p>
          )}
          {story.author && (
            <p className="mt-3 flex items-center gap-1.5 text-sm">
              <PenLine className="size-4 text-muted-foreground" />
              <Link
                href={`/tim-kiem?q=${encodeURIComponent(story.author.name)}`}
                className="font-medium hover:text-primary"
              >
                {story.author.name}
              </Link>
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat icon={<ListOrdered />} label="Số chương">
              {formatNumber(story.chapterCount)}
            </Stat>
            <Stat icon={<Eye />} label="Lượt xem">
              {formatNumber(story.viewCount)}
            </Stat>
            <Stat icon={<Activity />} label="Trạng thái">
              {STATUS_LABEL[story.status]}
            </Stat>
            <Stat icon={<Clock />} label="Cập nhật">
              {story.latestChapterAt ? <TimeAgo date={story.latestChapterAt} /> : "—"}
            </Stat>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {story.firstChapter !== null && (
              <Button asChild size="lg" className="rounded-full bg-brand shadow-lg shadow-primary/25 hover:opacity-95">
                <Link href={chapterHref(story.slug, story.firstChapter)}>
                  <BookOpen /> Đọc từ đầu
                </Link>
              </Button>
            )}
            {story.lastChapter && story.lastChapter.number !== story.firstChapter && (
              <Button asChild size="lg" variant="outline" className="rounded-full bg-background/60 backdrop-blur">
                <Link href={chapterHref(story.slug, story.lastChapter.number)}>
                  <Sparkles /> Chương {formatChapterNumber(story.lastChapter.number)}
                </Link>
              </Button>
            )}
            <ContinueReading slug={story.slug} />
          </div>
          <div className="mt-5">
            <StoryInteractions
              storyId={story.id}
              followCount={story.followCount}
              rating={story.rating}
              ratingCount={story.ratingCount}
            />
          </div>
          {story.sourceNames.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">Nguồn: {story.sourceNames.join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

async function ChapterList({
  story,
  searchParams,
}: {
  story: StoryDetail;
  searchParams: PageProps<"/truyen/[slug]">["searchParams"];
}) {
  const sp = await searchParams;
  const order = sp.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.page) || 1);
  const { chapters, pageCount } = await getChapterPage(story.id, page, order);

  const href = (p: number, o = order) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (o === "desc") params.set("order", "desc");
    const qs = params.toString();
    return `/truyen/${story.slug}${qs ? `?${qs}` : ""}#danh-sach-chuong`;
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          Danh sách chương <span className="font-normal text-muted-foreground">({formatNumber(story.chapterCount)})</span>
        </h2>
        <Link
          href={href(1, order === "asc" ? "desc" : "asc")}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          <ArrowDownUp className="size-4" /> {order === "asc" ? "Cũ → mới" : "Mới → cũ"}
        </Link>
      </div>
      {chapters.length ? (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((c) => (
            <li key={c.number}>
              <Link
                href={chapterHref(story.slug, c.number)}
                className="block truncate rounded-lg border border-transparent bg-muted/50 px-3 py-2 text-sm transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">Chương {formatChapterNumber(c.number)}</span>
                {c.title && <span className="text-muted-foreground">: {c.title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-muted-foreground">Truyện chưa có chương nào.</p>
      )}
      <Pagination page={page} pageCount={pageCount} href={(p) => href(p)} />
    </>
  );
}

function StoryJsonLd({ story }: { story: StoryDetail }) {
  const data = {
    "@context": "https://schema.org",
    "@type": story.type === "COMIC" ? "ComicSeries" : "Book",
    name: story.title,
    url: `${SITE_URL}/truyen/${story.slug}`,
    image: story.cover ? `${SITE_URL}${story.cover}` : undefined,
    author: story.author ? { "@type": "Person", name: story.author.name } : undefined,
    genre: story.genres.map((g) => g.name),
    description: stripHtml(story.description).slice(0, 500) || undefined,
    inLanguage: "vi",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

async function StoryView({ params, searchParams }: PageProps<"/truyen/[slug]">) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  return (
    <>
      <StoryHeader story={story} />
      {story.description && (
        <section className="mt-10 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-bold">Giới thiệu</h2>
          <ExpandableHtml html={story.description} className="prose-desc text-sm leading-relaxed text-foreground/85" />
        </section>
      )}
      <section id="danh-sach-chuong" className="mt-6 scroll-mt-24 rounded-2xl border bg-card p-5 sm:p-6">
        <Suspense fallback={<div className="skeleton h-72 rounded-xl" />}>
          <ChapterList story={story} searchParams={searchParams} />
        </Suspense>
      </section>
      <div className="mt-6">
        <CommentSection storyId={story.id} />
      </div>
      <StoryJsonLd story={story} />
    </>
  );
}

function StorySkeleton() {
  return (
    <div className="flex flex-col gap-8 pt-4 sm:flex-row">
      <div className="skeleton mx-auto aspect-[3/4] w-48 rounded-2xl sm:mx-0 sm:w-56" />
      <div className="flex-1 space-y-3">
        <div className="skeleton h-5 w-40 rounded-full" />
        <div className="skeleton h-10 w-3/4 rounded-lg" />
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="grid grid-cols-2 gap-2.5 pt-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StoryPage(props: PageProps<"/truyen/[slug]">) {
  return (
    <PageTransition>
      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <Suspense
          fallback={
            <SkeletonOut>
              <StorySkeleton />
            </SkeletonOut>
          }
        >
          <Reveal>
            <StoryView {...props} />
          </Reveal>
        </Suspense>
      </div>
    </PageTransition>
  );
}
