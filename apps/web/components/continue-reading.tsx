"use client";

import Link from "next/link";
import { BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chapterHref, formatChapterNumber } from "@/lib/format";
import { useHistory } from "@/lib/history";

/** Nút "Đọc tiếp" theo lịch sử đọc trên trình duyệt. */
export function ContinueReading({ slug }: { slug: string }) {
  const chapter = useHistory()?.find((e) => e.slug === slug)?.chapter;
  if (chapter === undefined) return null;
  return (
    <Button asChild variant="secondary">
      <Link href={chapterHref(slug, chapter)}>
        <BookmarkCheck /> Đọc tiếp chương {formatChapterNumber(chapter)}
      </Link>
    </Button>
  );
}
