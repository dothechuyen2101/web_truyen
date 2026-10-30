import { describe, expect, it } from "vitest";
import {
  parseWetruyenChapter,
  parseWetruyenChapterPage,
  parseWetruyenList,
  parseWetruyenStory,
} from "../src/adapters/wetruyen";
import { brToParagraphs } from "../src/normalize";
import { fixture } from "./helpers";

const BASE = "https://wetruyen.com";

describe("wetruyen", () => {
  it("đọc trang mới cập nhật, lấy số chương từ dòng “N chương”", () => {
    const { items, hasNext } = parseWetruyenList(fixture("wetruyen/latest.html"), BASE);
    expect(hasNext).toBe(true);
    expect(items).toHaveLength(25);
    expect(items[0]).toEqual({
      path: "/coi-doi-sang-to-dai-co-nuong.24999/",
      title: "Cõi Đời Sáng Tỏ - Đại Cô Nương",
      coverUrl: expect.stringMatching(/^https:\/\/cdn\.wetruyen\.com\//),
      latestChapter: 151,
    });
  });

  it("đọc thông tin truyện, bỏ tên tác giả ở cuối tiêu đề", () => {
    const story = parseWetruyenStory(fixture("wetruyen/story-long.html"), BASE, "/dan-dao-tong-su-chi-thi-tieu-ha-me.24967/");
    expect(story.title).toBe("Đan Đạo Tông Sư");
    expect(story.author).toBe("Chỉ Thị Tiểu Hà Mễ");
    expect(story.status).toBe("ONGOING");
    expect(story.genres).toContain("Tiên Hiệp");
  });

  it("mô tả ngăn bằng <br><br> được tách thành đoạn", () => {
    const story = parseWetruyenStory(fixture("wetruyen/story.html"), BASE, "/vi-chang-ta-nguyen-danh-cuoc.24150/");
    expect(story.status).toBe("COMPLETED");
    expect((story.description?.match(/<p>/g) ?? []).length).toBeGreaterThan(3);
  });

  it("đọc danh sách chương và tổng số trang từ link Last", () => {
    const { chapters, totalPages } = parseWetruyenChapterPage(fixture("wetruyen/story-long.html"), BASE);
    expect(totalPages).toBe(89);
    expect(chapters).toHaveLength(50);
    expect(chapters[0]).toEqual({
      path: "/dan-dao-tong-su-chi-thi-tieu-ha-me/chuong-1.html",
      number: 1,
      title: "Cửu U Bí Lục",
    });
  });

  it("nội dung viết liền bằng <br> được chia đoạn", () => {
    const content = parseWetruyenChapter(fixture("wetruyen/chapter.html"));
    if (content.kind !== "text") throw new Error("expected text");
    expect(content.html).toMatch(/^<p>Bùi Thiếu Hằng nghiến răng nghiến lợi\.<\/p>/);
    expect((content.html.match(/<p>/g) ?? []).length).toBeGreaterThan(20);
    expect(content.html).not.toMatch(/wetruyen|<br/i);
  });

  it("brToParagraphs", () => {
    expect(brToParagraphs("A<br>B<br/><br />C")).toBe("<p>A</p><p>B</p><p>C</p>");
    expect(brToParagraphs("<p>A<br><br>B</p>")).toBe("<p>A</p><p>B</p>");
  });
});
