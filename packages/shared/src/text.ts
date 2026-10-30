/** Bỏ dấu tiếng Việt: "Đấu Phá Thương Khung" -> "Dau Pha Thuong Khung". */
export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function slugify(input: string): string {
  return removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Chuỗi không dấu, chữ thường, chỉ còn chữ/số cách nhau một khoảng trắng — dùng để tìm kiếm và ghép truyện. */
export function toSearchText(...parts: Array<string | null | undefined>): string {
  return removeDiacritics(parts.filter(Boolean).join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** 136.5 -> "136.5", 12 -> "12". Dùng cho URL và hiển thị số chương. */
export function formatChapterNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}
