"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, Heart, History, X } from "lucide-react";
import { Cover } from "@/components/cover";
import { TimeAgo } from "@/components/time-ago";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/components/user-menu";
import { useSession } from "@/lib/auth-client";
import { chapterHref, formatChapterNumber } from "@/lib/format";
import { removeHistory, useHistory } from "@/lib/history";
import { cn } from "@/lib/utils";

interface LibraryStory {
  slug: string;
  title: string;
  cover: string | null;
  latestChapter: number | null;
  latestChapterAt: string | null;
}

interface Library {
  follows: LibraryStory[];
  history: (LibraryStory & { chapter: number; at: number })[];
}

interface Entry {
  slug: string;
  title: string;
  cover: string | null;
  chapter: number;
  at: number;
}

function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary [&_svg]:size-7">{icon}</span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

function StoryRow({
  index,
  slug,
  title,
  cover,
  children,
  onRemove,
}: {
  index: number;
  slug: string;
  title: string;
  cover: string | null;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <li
      className="group relative flex animate-in gap-3 rounded-2xl border bg-card p-3 transition-all duration-500 fill-mode-both fade-in slide-in-from-bottom-2 hover:border-primary/40 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <Link href={`/truyen/${slug}`} className="shrink-0">
        <Cover src={cover} alt={title} className="w-16 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1 pr-6">
        <Link href={`/truyen/${slug}`} className="line-clamp-2 font-semibold transition-colors hover:text-primary">
          {title}
        </Link>
        {children}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
          aria-label={`Xoá ${title} khỏi lịch sử`}
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

export function ReadingHistory() {
  const local = useHistory();
  const { data: session, isPending } = useSession();
  const [library, setLibrary] = useState<Library | null>(null);
  const [tab, setTab] = useState<"history" | "follows">("history");
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/me/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Library | null) => !cancelled && setLibrary(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Gộp lịch sử trên trình duyệt với lịch sử trên server, giữ bản đọc gần nhất của mỗi truyện.
  const history = useMemo(() => {
    const merged = new Map<string, Entry>();
    for (const e of [...(local ?? []), ...(library?.history ?? [])]) {
      const prev = merged.get(e.slug);
      if (!prev || e.at > prev.at) merged.set(e.slug, { slug: e.slug, title: e.title, cover: e.cover, chapter: e.chapter, at: e.at });
    }
    return [...merged.values()].sort((a, b) => b.at - a.at);
  }, [local, library]);

  if (local === null) return null;

  const tabs = [
    { key: "history" as const, label: "Lịch sử đọc", icon: <History className="size-4" />, count: history.length },
    { key: "follows" as const, label: "Đang theo dõi", icon: <Heart className="size-4" />, count: library?.follows.length },
  ];

  return (
    <div>
      <div className="mb-6 inline-flex rounded-full border bg-card p-1 shadow-sm" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              tab === t.key ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon} {t.label}
            {t.count !== undefined && <span className="tabular-nums opacity-75">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "history" &&
        (history.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((e, i) => (
              <StoryRow key={e.slug} index={i} slug={e.slug} title={e.title} cover={e.cover} onRemove={() => removeHistory(e.slug)}>
                <Link
                  href={chapterHref(e.slug, e.chapter)}
                  className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-brand hover:text-white"
                >
                  Đọc tiếp chương {formatChapterNumber(e.chapter)}
                </Link>
                <TimeAgo date={new Date(e.at)} className="mt-1.5 block text-xs text-muted-foreground" />
              </StoryRow>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BookMarked />}
            title="Chưa có lịch sử đọc"
            hint="Truyện bạn đọc sẽ tự động xuất hiện ở đây."
            action={
              <Button asChild className="mt-5 rounded-full bg-brand">
                <Link href="/">Khám phá truyện</Link>
              </Button>
            }
          />
        ))}

      {tab === "follows" &&
        (!userId ? (
          <EmptyState
            icon={<Heart />}
            title={isPending ? "Đang tải…" : "Đăng nhập để theo dõi truyện"}
            hint="Truyện bạn theo dõi được đồng bộ trên mọi thiết bị."
            action={
              !isPending && (
                <Button className="mt-5 rounded-full bg-brand" onClick={() => (location.href = loginHref())}>
                  Đăng nhập
                </Button>
              )
            }
          />
        ) : library === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : library.follows.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {library.follows.map((s, i) => (
              <StoryRow key={s.slug} index={i} slug={s.slug} title={s.title} cover={s.cover}>
                {s.latestChapter !== null && (
                  <Link
                    href={chapterHref(s.slug, s.latestChapter)}
                    className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-brand hover:text-white"
                  >
                    Mới nhất: chương {formatChapterNumber(s.latestChapter)}
                  </Link>
                )}
                {s.latestChapterAt && (
                  <TimeAgo date={s.latestChapterAt} className="mt-1.5 block text-xs text-muted-foreground" />
                )}
              </StoryRow>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Heart />} title="Chưa theo dõi truyện nào" hint="Bấm “Theo dõi” ở trang truyện để thêm vào đây." />
        ))}
    </div>
  );
}
