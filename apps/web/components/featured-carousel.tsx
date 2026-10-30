"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeaturedStory } from "@/lib/data";
import { formatChapterNumber, TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6500;
const SWIPE_PX = 50;

/** Banner truyện nổi bật: tự chuyển, dừng khi rê chuột, vuốt được trên mobile. */
export function FeaturedCarousel({ items }: { items: FeaturedStory[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bìa tải lỗi (nguồn chặn/chập chờn) → ẩn hẳn thay vì hiện ảnh vỡ.
  const [brokenCovers, setBrokenCovers] = useState<ReadonlySet<number>>(new Set());
  const startX = useRef<number | null>(null);
  const count = items.length;

  useEffect(() => {
    if (paused || count < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (!count) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const story = items[index]!;
  const coverOf = (s: FeaturedStory) => (brokenCovers.has(s.id) ? null : s.cover);
  const markBroken = (id: number) => setBrokenCovers((prev) => new Set(prev).add(id));

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Truyện nổi bật"
      className="relative isolate overflow-hidden rounded-3xl border bg-card shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
        startX.current = null;
      }}
    >
      {/* Nền: ảnh bìa phóng to, làm mờ; các slide chồng lên nhau và mờ dần khi đổi */}
      {items.map((s, i) => (
        <div
          key={s.id}
          aria-hidden
          className={cn(
            "absolute inset-0 -z-10 transition-opacity duration-1000 ease-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
        >
          {coverOf(s) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverOf(s)!} alt="" onError={() => markBroken(s.id)} className="size-full scale-125 object-cover opacity-50 blur-3xl saturate-150 dark:opacity-40" />
          )}
        </div>
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-card via-card/85 to-card/30" />

      <div className="flex min-h-[300px] items-center gap-8 p-6 sm:min-h-[360px] sm:p-10">
        <div key={story.id} className="min-w-0 flex-1 animate-in duration-700 fade-in slide-in-from-bottom-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-white">{TYPE_LABEL[story.type]}</span>
            {story.genres.map((g) => (
              <span key={g.slug} className="rounded-full border bg-background/60 px-2.5 py-0.5 backdrop-blur">
                {g.name}
              </span>
            ))}
          </div>
          <h2 className="line-clamp-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{story.title}</h2>
          <p className="mt-3 line-clamp-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{story.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full bg-brand shadow-lg shadow-primary/25 hover:opacity-95">
              <Link href={`/truyen/${story.slug}`}>
                <BookOpen /> Đọc ngay
              </Link>
            </Button>
            {story.latestChapter !== null && (
              <span className="text-sm text-muted-foreground">
                {story.chapterCount.toLocaleString("vi-VN")} chương · mới nhất chương{" "}
                {formatChapterNumber(story.latestChapter)}
              </span>
            )}
          </div>
          {count > 1 && (
            <div className="mt-6 flex items-center gap-2">
              <Button variant="outline" size="icon-sm" className="rounded-full bg-background/70 backdrop-blur" onClick={() => go(-1)} aria-label="Truyện trước">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" className="rounded-full bg-background/70 backdrop-blur" onClick={() => go(1)} aria-label="Truyện sau">
                <ChevronRight />
              </Button>
              <div className="ml-1 flex gap-1.5">
                {items.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Chuyển tới ${s.title}`}
                    aria-current={i === index}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/25 hover:bg-foreground/50",
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {coverOf(story) && (
          <Link
            key={`cover-${story.id}`}
            href={`/truyen/${story.slug}`}
            className="hidden w-44 shrink-0 animate-in duration-700 fade-in zoom-in-95 sm:block lg:w-52"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverOf(story)!}
              alt={story.title}
              onError={() => markBroken(story.id)}
              className="aspect-[3/4] w-full rotate-2 rounded-2xl object-cover shadow-2xl ring-1 ring-white/20 transition-transform duration-500 hover:rotate-0 hover:scale-[1.03]"
            />
          </Link>
        )}
      </div>

    </section>
  );
}
