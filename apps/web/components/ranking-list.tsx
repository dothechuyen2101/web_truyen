import Link from "next/link";
import { Eye } from "lucide-react";
import type { StoryCard } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";

export function RankingList({ stories }: { stories: StoryCard[] }) {
  return (
    <ol className="space-y-1">
      {stories.map((s, i) => (
        <li key={s.id}>
          <Link
            href={`/truyen/${s.slug}`}
            className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                "w-6 shrink-0 text-center text-lg font-extrabold tabular-nums text-muted-foreground/50",
                i < 3 && "text-brand text-xl",
              )}
            >
              {i + 1}
            </span>
            <Cover
              src={s.cover}
              alt={s.title}
              className="w-12 shrink-0 rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary">
                {s.title}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="size-3.5" /> {formatNumber(s.viewCount)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
