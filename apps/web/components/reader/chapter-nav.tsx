"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chapterHref, formatChapterNumber } from "@/lib/format";

interface ChapterOption {
  number: number;
  title: string | null;
}

function NavButton({ href, direction }: { href: string | null; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Chương trước" : "Chương sau";
  const content =
    direction === "prev" ? (
      <>
        <ChevronLeft /> <span className="hidden sm:inline">{label}</span>
      </>
    ) : (
      <>
        <span className="hidden sm:inline">{label}</span> <ChevronRight />
      </>
    );
  if (!href) {
    return (
      <Button variant="ghost" disabled aria-label={label} className="rounded-full">
        {content}
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" aria-label={label} className="rounded-full hover:bg-accent hover:text-accent-foreground">
      <Link href={href}>{content}</Link>
    </Button>
  );
}

/**
 * Thanh chuyển chương. Danh sách chương cho ô chọn chỉ tải khi người đọc mở ô,
 * tránh nhúng hàng nghìn chương vào mỗi trang.
 */
export function ChapterNav({
  storyId,
  slug,
  current,
  prev,
  next,
}: {
  storyId: number;
  slug: string;
  current: number;
  prev: number | null;
  next: number | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<ChapterOption[] | null>(null);

  async function loadOptions() {
    if (options) return;
    const res = await fetch(`/api/stories/${storyId}/chapters`);
    if (res.ok) setOptions(await res.json());
  }

  return (
    <nav className="mx-auto flex w-fit max-w-full items-center gap-1 rounded-full border bg-card/80 p-1 shadow-sm backdrop-blur">
      <NavButton href={prev !== null ? chapterHref(slug, prev) : null} direction="prev" />
      <label className="relative">
        <span className="sr-only">Chọn chương</span>
        <List className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={current}
          onFocus={loadOptions}
          onPointerDown={loadOptions}
          onChange={(e) => router.push(chapterHref(slug, Number(e.target.value)))}
          className="h-9 max-w-40 cursor-pointer appearance-none rounded-full bg-muted pr-4 pl-9 text-sm font-medium transition-colors hover:bg-accent sm:max-w-64"
        >
          {(options ?? [{ number: current, title: null }]).map((c) => (
            <option key={c.number} value={c.number}>
              Chương {formatChapterNumber(c.number)}
              {c.title ? `: ${c.title}` : ""}
            </option>
          ))}
        </select>
      </label>
      <NavButton href={next !== null ? chapterHref(slug, next) : null} direction="next" />
    </nav>
  );
}
