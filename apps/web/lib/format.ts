import { formatChapterNumber } from "@truyen/shared";

export { formatChapterNumber };

export const chapterHref = (slug: string, number: number) =>
  `/truyen/${slug}/chuong-${formatChapterNumber(number)}`;

/** "chuong-136.5" -> 136.5 */
export function parseChapterParam(param: string): number | null {
  const m = decodeURIComponent(param).match(/^chuong-(\d+(?:\.\d+)?)$/);
  return m?.[1] ? Number(m[1]) : null;
}

export const STATUS_LABEL = {
  ONGOING: "Đang ra",
  COMPLETED: "Hoàn thành",
  UNKNOWN: "Chưa rõ",
} as const;

export const TYPE_LABEL = { NOVEL: "Truyện chữ", COMIC: "Truyện tranh" } as const;

export const stripHtml = (html: string | null | undefined) =>
  (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const numberFormat = new Intl.NumberFormat("vi-VN");
export const formatNumber = (n: number) => numberFormat.format(n);

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
export const formatDate = (d: Date | string) => dateFormat.format(new Date(d));
