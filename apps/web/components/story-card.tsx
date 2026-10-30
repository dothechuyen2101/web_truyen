import Link from "next/link";
import type { StoryCard as StoryCardData } from "@/lib/data";
import { formatChapterNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";
import { TimeAgo } from "./time-ago";

export function StoryCard({ story, showType = false }: { story: StoryCardData; showType?: boolean }) {
  return (
    <Link href={`/truyen/${story.slug}`} className="group reveal-on-scroll block min-w-0">
      <div className="relative overflow-hidden rounded-xl shadow-sm ring-1 ring-border/70 transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:ring-primary/50">
        <Cover src={story.cover} alt={story.title} className="rounded-none" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300 group-hover:opacity-90" />
        <div className="absolute top-2 left-2 flex gap-1 text-[10px] font-semibold tracking-wide uppercase">
          {showType && (
            <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-white ring-1 ring-white/20 backdrop-blur-md">
              {story.type === "COMIC" ? "Tranh" : "Chữ"}
            </span>
          )}
          {story.status === "COMPLETED" && (
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-white shadow-sm">Full</span>
          )}
        </div>
        {story.latestChapter !== null && (
          <span className="absolute bottom-2 left-2 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/20 backdrop-blur-md">
            Chương {formatChapterNumber(story.latestChapter)}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary">
        {story.title}
      </h3>
      {story.latestChapterAt && (
        <TimeAgo date={story.latestChapterAt} className="mt-0.5 block text-xs text-muted-foreground" />
      )}
    </Link>
  );
}

const GRID = "grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-6";

export function StoryGrid({
  stories,
  showType,
  className,
}: {
  stories: StoryCardData[];
  showType?: boolean;
  className?: string;
}) {
  if (!stories.length) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
        Chưa có truyện nào.
      </div>
    );
  }
  return (
    <div className={cn(GRID, className)}>
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} showType={showType} />
      ))}
    </div>
  );
}

export function StoryGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID} aria-label="Đang tải">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[3/4] rounded-xl" />
          <div className="skeleton mt-2.5 h-4 w-4/5 rounded" />
          <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
