import { describe, expect, it } from "vitest";
import {
  parseTruyenfullChapter,
  parseTruyenfullChapterPage,
  parseTruyenfullList,
  parseTruyenfullStory,
} from "../src/adapters/truyenfull";
import { fixture } from "./helpers";

const BASE = "https://truyenfull.live";

describe("truyenfull", () => {
  it("đọc trang danh sách mới cập nhật", () => {
    const { items, hasNext } = parseTruyenfullList(fixture("truyenfull/list-truyen-moi.html"), BASE);
    expect(hasNext).toBe(true);
    expect(items.length).toBeGreaterThan(20);
    expect(items[0]).toEqual({
      path: "/phuc-bao-lam-nong-o-sua-mot-cai-sinh-ca-tan-linh-chi/",
      title: "Phúc Bảo Làm Nông: Ợ Sữa Một Cái Sinh Cả Tấn Linh Chi",
      coverUrl: expect.stringMatching(/^https:\/\/static\.truyenfull\.live\/cover\//),
      latestChapter: 287,
    });
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
  });

  it("đọc thông tin truyện và bỏ qua phần tử mồi bị ẩn bằng CSS", () => {
    const story = parseTruyenfullStory(
      fixture("truyenfull/story.html"),
      BASE,
      "/thang-tu-on-hoa-mong-tieu-nhi/",
    );
    expect(story.title).toBe("Tháng Tư Ôn Hòa");
    expect(story.author).toBe("Mộng Tiêu Nhị");
    // "Tiên Hiệp, Huyền Huyễn" và "Khuyết danh" là mồi bị ẩn
    expect(story.genres).toEqual(["Ngôn Tình", "Đô Thị", "Sủng"]);
    expect(story.status).toBe("COMPLETED");
    expect(story.coverUrl).toMatch(/thang-tu-on-hoa-mong-tieu-nhi\.jpg$/);
    expect(story.description).toContain("Hứa Thanh Hòa");
    expect(story.description).not.toMatch(/truyen\s*full/i);
  });

  it("đọc danh sách chương và số trang", () => {
    const page1 = parseTruyenfullChapterPage(fixture("truyenfull/story.html"), BASE);
    const page2 = parseTruyenfullChapterPage(fixture("truyenfull/story-page2.html"), BASE);
    expect(page1.totalPages).toBe(2);
    expect(page1.chapters).toHaveLength(50);
    expect(page1.chapters[0]).toEqual({
      path: "/thang-tu-on-hoa-mong-tieu-nhi/chuong-1/",
      number: 1,
      title: "Anh đi tu nghiệp về rồi sao?",
    });
    expect(page2.chapters.at(-1)?.number).toBe(63);
  });

  it("làm sạch nội dung chương", () => {
    const content = parseTruyenfullChapter(fixture("truyenfull/chapter.html"));
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.html).toMatch(/^<p>Binh sĩ Đại Thụy/);
    expect(content.html).toContain("cá chết lưới rách");
    expect(content.html).not.toMatch(/truyen\s*full|quảng cáo|<a |<div|style=/i);
  });
});
