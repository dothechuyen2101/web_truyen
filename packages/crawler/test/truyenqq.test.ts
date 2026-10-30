import { describe, expect, it } from "vitest";
import {
  parseTruyenqqChapter,
  parseTruyenqqChapterList,
  parseTruyenqqList,
  parseTruyenqqStory,
} from "../src/adapters/truyenqq";
import { fixture } from "./helpers";

const BASE = "https://truyenqqko.com";

describe("truyenqq", () => {
  it("đọc trang truyện mới cập nhật", () => {
    const { items, hasNext } = parseTruyenqqList(fixture("truyenqq/latest.html"), BASE, 1);
    expect(hasNext).toBe(true);
    expect(items.length).toBeGreaterThan(30);
    expect(items[0]).toEqual({
      path: "/truyen-tranh/dai-quan-gia-la-ma-hoang-7015",
      title: "Đại Quản Gia Là Ma Hoàng",
      coverUrl: expect.stringMatching(/^https:\/\/i\.hinhhinh\.com\//),
      latestChapter: 929,
    });
  });

  it("đọc thông tin truyện, bỏ phần mô tả toàn câu SEO", () => {
    const story = parseTruyenqqStory(fixture("truyenqq/story.html"), BASE, "/truyen-tranh/bai-kien-giao-chu-dai-nhan-22910");
    expect(story.title).toBe("Bái Kiến Giáo Chủ Đại Nhân");
    expect(story.author).toBe("Mộng Tiên Giới");
    expect(story.genres).toEqual(["Action", "Manhua", "Xuyên Không", "Chuyển Sinh", "Huyền Huyễn"]);
    expect(story.status).toBe("ONGOING");
    expect(story.coverUrl).toMatch(/truyenvua\.com/);
    expect(story.description).toBeUndefined();
  });

  it("đọc danh sách chương, chương lẻ dạng -chap-34-1", () => {
    const chapters = parseTruyenqqChapterList(fixture("truyenqq/story.html"), BASE);
    expect(chapters).toHaveLength(46);
    expect(chapters[0]).toEqual({ path: "/truyen-tranh/bai-kien-giao-chu-dai-nhan-22910-chap-41", number: 41, title: undefined });
    expect(chapters.find((c) => c.path.endsWith("-chap-34-1"))).toMatchObject({ number: 34.1, title: "Chương 34.1 (Fix)" });
    expect(chapters.every((c) => Number.isFinite(c.number))).toBe(true);
  });

  it("lấy URL ảnh chương từ data-cdn", () => {
    const content = parseTruyenqqChapter(fixture("truyenqq/chapter.html"), BASE);
    if (content.kind !== "images") throw new Error("expected images");
    expect(content.urls).toHaveLength(29);
    expect(content.urls[0]).toBe("https://i178.truyenvua.com/22910/40/chap_22910-time_1792559939-6ad84b436d0bc.jpg");
    expect(content.urls.every((u) => new URL(u).hostname.endsWith("truyenvua.com"))).toBe(true);
  });
});
