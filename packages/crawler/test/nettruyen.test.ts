import { describe, expect, it } from "vitest";
import {
  parseNettruyenChapter,
  parseNettruyenChapterListHtml,
  parseNettruyenChapterListJson,
  parseNettruyenList,
  parseNettruyenStory,
} from "../src/adapters/nettruyen";
import { fixture } from "./helpers";

const BASE = "https://nettruyen.gg";

describe("nettruyen", () => {
  it("đọc trang danh sách, lấy ảnh bìa thật thay vì ảnh placeholder", () => {
    const { items, hasNext } = parseNettruyenList(fixture("nettruyen/home.html"), BASE);
    expect(hasNext).toBe(true);
    expect(items.length).toBeGreaterThan(30);
    expect(items[1]).toEqual({
      path: "/truyen-tranh/gay-go-cap-99",
      title: "Gậy Gỗ Cấp 99+",
      coverUrl: "https://image2.kcgsbok.com/nettruyen/thumb/gay-go-cap-99.jpg",
      latestChapter: 232,
    });
    expect(items.every((i) => !i.coverUrl?.includes("thumb-default"))).toBe(true);
  });

  it("đọc thông tin truyện, bỏ tác giả giả và câu SEO trong mô tả", () => {
    const story = parseNettruyenStory(fixture("nettruyen/story.html"), BASE, "/truyen-tranh/gay-go-cap-99");
    expect(story.title).toBe("Gậy Gỗ Cấp 99+");
    expect(story.author).toBeUndefined();
    expect(story.genres).toEqual(["Action", "Comedy", "Manhwa", "Truyện Màu"]);
    expect(story.status).toBe("ONGOING");
    expect(story.description).toMatch(/^<p>Đây là phiên bản gậy gỗ Saitama/);
    expect(story.description).not.toMatch(/nettruyen|lượt xem/i);
  });

  it("bỏ câu quảng cáo của trang khác trong mô tả", () => {
    const html = fixture("nettruyen/story.html").replace(
      "Đây là phiên bản gậy gỗ Saitama",
      "Truyện tranh Gậy Gỗ được cập nhật sớm nhất và đầy đủ tại TopTruyenTv. Bạn đọc đừng quên bình luận và chia sẻ.\nĐây là phiên bản gậy gỗ Saitama",
    );
    const story = parseNettruyenStory(html, BASE, "/truyen-tranh/gay-go-cap-99");
    expect(story.description).not.toMatch(/toptruyen|bình luận/i);
    expect(story.description).toMatch(/^<p>Đây là phiên bản gậy gỗ Saitama/);
  });

  it("đọc danh sách chương từ API JSON (có chương lẻ)", () => {
    const chapters = parseNettruyenChapterListJson(
      JSON.parse(fixture("nettruyen/chapter-list.json")),
      "gay-go-cap-99",
    );
    expect(chapters[0]).toEqual({ path: "/truyen-tranh/gay-go-cap-99/chuong-232", number: 232, title: undefined });
    expect(chapters.map((c) => c.number)).toContain(1.5);
  });

  it("đọc danh sách chương dự phòng từ HTML", () => {
    const chapters = parseNettruyenChapterListHtml(fixture("nettruyen/story.html"), BASE);
    expect(chapters).toHaveLength(20);
    expect(chapters[0]?.number).toBe(232);
  });

  it("lấy URL ảnh chương, bỏ ảnh thông báo trên domain nguồn", () => {
    const content = parseNettruyenChapter(fixture("nettruyen/chapter.html"), BASE);
    expect(content.kind).toBe("images");
    if (content.kind !== "images") return;
    expect(content.urls).toHaveLength(280);
    expect(content.urls[0]).toBe("https://image1.kcgsbok.com/nettruyen/gay-go-cap-99/231/0.jpg");
    expect(content.urls.every((u) => new URL(u).hostname.endsWith("kcgsbok.com"))).toBe(true);
  });
});
