import { describe, expect, it } from "vitest";
import { formatChapterNumber, removeDiacritics, slugify, toSearchText } from "./text";

describe("text", () => {
  it("bỏ dấu tiếng Việt, kể cả đ/Đ", () => {
    expect(removeDiacritics("Đấu Phá Thương Khung")).toBe("Dau Pha Thuong Khung");
  });

  it("tạo slug", () => {
    expect(slugify("  Gậy Gỗ Cấp 99+ ")).toBe("gay-go-cap-99");
  });

  it("tạo chuỗi tìm kiếm từ nhiều phần", () => {
    expect(toSearchText("Phúc Bảo Làm Nông", null, "Mộng Tiêu Nhị")).toBe(
      "phuc bao lam nong mong tieu nhi",
    );
  });

  it("định dạng số chương", () => {
    expect(formatChapterNumber(136.5)).toBe("136.5");
    expect(formatChapterNumber(12)).toBe("12");
    expect(formatChapterNumber(10.1)).toBe("10.1");
  });
});
