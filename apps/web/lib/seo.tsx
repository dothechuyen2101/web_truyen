import type { StoryStatus, StoryType } from "@truyen/db";
import { formatChapterNumber, stripHtml } from "./format";
import { SITE_NAME, SITE_URL } from "./site";

/** Độ dài mô tả Google thường hiển thị */
const DESCRIPTION_LENGTH = 160;

/** Cắt ở ranh giới từ, thêm "…" khi bị cắt. */
export function clip(text: string, max = DESCRIPTION_LENGTH) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

/** Người đọc truyện tranh hay tìm "tên truyện chap 120", truyện chữ thì "chương 120". */
function chapterLabel(type: StoryType, number: number) {
  return `${type === "COMIC" ? "Chap" : "Chương"} ${formatChapterNumber(number)}`;
}

const kindLabel = (type: StoryType) => (type === "COMIC" ? "Truyện Tranh" : "Truyện Chữ");

interface StoryForSeo {
  title: string;
  type: StoryType;
  status: StoryStatus;
  altTitles: string[];
  description: string | null;
  lastChapter: { number: number } | null;
}

/** Tiêu đề + mô tả trang truyện, vd "Đại Quản Gia Là Ma Hoàng [Tới Chap 928] - Truyện Tranh". */
export function storySeo(story: StoryForSeo) {
  const latest = story.lastChapter ? chapterLabel(story.type, story.lastChapter.number) : null;
  const kind = kindLabel(story.type);
  const title = `${story.title}${latest ? ` [Tới ${latest}]` : ""} - ${kind}${story.status === "COMPLETED" ? " Full" : ""}`;
  // Tên khác giúp người tìm theo tên gốc/tên tiếng Anh vẫn thấy truyện.
  const alt = story.altTitles.filter((t) => t !== story.title).slice(0, 2).join(", ");
  const lead = `Đọc ${kind.toLowerCase()} ${story.title}${alt ? ` (${alt})` : ""} tiếng Việt${latest ? `, mới nhất ${latest.toLowerCase()}` : ""}.`;
  return { title, description: clip(`${lead} ${stripHtml(story.description)}`) };
}

/** Tiêu đề + mô tả trang chương, vd "Đại Quản Gia Là Ma Hoàng Chap 1 Tiếng Việt". */
export function chapterSeo(story: Pick<StoryForSeo, "title" | "type">, chapter: { number: number; title: string | null }) {
  const label = chapterLabel(story.type, chapter.number);
  const comic = story.type === "COMIC";
  const title = `${story.title} ${label}${chapter.title ? `: ${chapter.title}` : ""}${comic ? " Tiếng Việt" : ""}`;
  const description = comic
    ? `Đọc truyện tranh ${story.title} ${label.toLowerCase()} tiếng Việt${chapter.title ? ` - ${chapter.title}` : ""}. Xem tiếp chap mới nhất của ${story.title} tại ${SITE_NAME}.`
    : `Đọc truyện ${story.title} ${label.toLowerCase()}${chapter.title ? `: ${chapter.title}` : ""} online. Đọc tiếp chương mới nhất của ${story.title} tại ${SITE_NAME}.`;
  return { title, description: clip(description) };
}

/** Dữ liệu breadcrumb cho Google (hiện đường dẫn thay cho URL trong kết quả tìm kiếm). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export const typeCrumb = (type: StoryType) =>
  type === "COMIC" ? { name: "Truyện tranh", path: "/truyen-tranh" } : { name: "Truyện chữ", path: "/truyen-chu" };

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // "<" trong dữ liệu có thể đóng thẻ script sớm.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
