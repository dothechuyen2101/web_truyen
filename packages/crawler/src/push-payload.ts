import { formatChapterNumber } from "@truyen/shared";

export interface PushPayload {
  title: string;
  body: string;
  /** Đường dẫn tương đối — service worker mở theo origin của site */
  url: string;
  /** Thông báo cùng truyện thay thế nhau thay vì chất đống */
  tag: string;
}

export function chapterPayload(
  story: { slug: string; title: string },
  chapter: { number: number; title: string | null },
): PushPayload {
  const n = formatChapterNumber(chapter.number);
  return {
    title: story.title,
    body: `Đã có chương ${n}${chapter.title ? `: ${chapter.title}` : ""} — đọc ngay!`,
    url: `/truyen/${story.slug}/chuong-${n}`,
    tag: `story-${story.slug}`,
  };
}
