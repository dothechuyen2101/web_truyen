import { describe, expect, it } from "vitest";
import {
  countFreePrefix,
  isManhuavnChapterFree,
  parseManhuavnAnyChapterLink,
  parseManhuavnChapter,
  parseManhuavnChapterSelect,
  parseManhuavnList,
  parseManhuavnStory,
} from "../src/adapters/manhuavn";
import { getAdapter, isAllowedImageHost } from "../src/adapters";
import { fixture } from "./helpers";

const BASE = "https://manhuavn2.com";

describe("manhuavn", () => {
  it("đọc trang mới cập nhật (ảnh bìa dạng background-image)", () => {
    const { items, hasNext } = parseManhuavnList(fixture("manhuavn/latest.html"), BASE, 1);
    expect(hasNext).toBe(true);
    expect(items).toHaveLength(50);
    expect(items[0]).toEqual({
      path: "/im-mieng-di-ac-long-ta-khong-muon-cung-nguoi-trong-tre-dau-0.html",
      title: "Im Miệng Đi Ác Long Ta Không Muốn Cùng Ngươi Trông Trẻ Đâu!",
      coverUrl: "https://admin.manhuavn2.com/Pictures/Truyen/Large/im-mieng-di-ac-long-ta-khong-muon-cung-nguoi-trong-tre-dau.jpg",
      latestChapter: 117,
    });
  });

  it("đọc thông tin truyện: bỏ mã nội bộ ở tên khác, tác giả giả, map thể loại", () => {
    const story = parseManhuavnStory(fixture("manhuavn/story.html"), "/bai-kien-giao-chu-dai-nhan-0.html");
    expect(story.title).toBe("Bái Kiến Giáo Chủ Đại Nhân");
    expect(story.altTitles).toEqual([]);
    expect(story.author).toBeUndefined();
    expect(story.genres).toEqual(["Cổ Đại", "Huyền Huyễn", "Trọng Sinh", "Xuyên Không", "Manhua"]);
    expect(story.status).toBe("ONGOING");
    expect(story.coverUrl).toBe("https://admin.manhuavn2.com/Pictures/Truyen/Large/bai-kien-giao-chu-dai-nhan.jpg");
    expect(story.description).toMatch(/^<p>Ngoài ý muốn bỏ mình, Sở Hưu/);
    expect(parseManhuavnAnyChapterLink(fixture("manhuavn/story.html"), BASE)).toBe(
      "/doc-truyen/bai-kien-giao-chu-dai-nhan-chapter-41.html",
    );
  });

  it("đọc đủ danh sách chương từ ô chọn chương của trang đọc", () => {
    const chapters = parseManhuavnChapterSelect(fixture("manhuavn/chapter.html"), BASE);
    expect(chapters).toHaveLength(41);
    expect(chapters[0]).toEqual({ path: "/doc-truyen/bai-kien-giao-chu-dai-nhan-chapter-1.html", number: 1, title: undefined });
    expect(chapters.map((c) => c.number)).toEqual(Array.from({ length: 41 }, (_, i) => i + 1));
  });

  it("bỏ chương video/thông báo và bản trùng số; lấy số từ chữ hiển thị khi URL lộn xộn", () => {
    const html = `<select id="selectchaptertop">
      <option value="/doc-truyen/x-chapter-thong-bao.html">Thông báo</option>
      <option value="/doc-truyen/x-chapter-66.html">Chapter 66</option>
      <option value="/doc-truyen/x-chapter-65-video.html">Chapter 65 Video</option>
      <option value="/doc-truyen/x-chapter-65--gau-gau.html">Chapter 65: Gâu gâu</option>
      <option value="/doc-truyen/x-chapter-65-fix.html">Chapter 65</option>
      <option value="/doc-truyen/x-chapter64.html">Chapter 64</option>
    </select>`;
    expect(parseManhuavnChapterSelect(html, BASE)).toEqual([
      { path: "/doc-truyen/x-chapter64.html", number: 64, title: undefined },
      { path: "/doc-truyen/x-chapter-65--gau-gau.html", number: 65, title: "Gâu gâu" },
      { path: "/doc-truyen/x-chapter-66.html", number: 66, title: undefined },
    ]);
  });

  it("phân biệt chương đọc được và chương chỉ có trên app", () => {
    expect(isManhuavnChapterFree(fixture("manhuavn/chapter.html"))).toBe(true);
    expect(isManhuavnChapterFree(fixture("manhuavn/locked.html"))).toBe(false);
    const content = parseManhuavnChapter(fixture("manhuavn/chapter.html"), "/c");
    expect(content.kind === "images" && content.urls.length).toBe(237);
    expect(content.kind === "images" && content.urls[0]).toMatch(/^https:\/\/img06\.g5img\.top\//);
    expect(() => parseManhuavnChapter(fixture("manhuavn/locked.html"), "/c")).toThrow(/chỉ có trên app/);
  });

  it("proxy ảnh cho phép mọi host ảnh nguồn dùng", () => {
    const adapter = getAdapter({ key: "manhuavn", baseUrl: BASE });
    for (const url of [
      "https://admin.manhuavn2.com/Pictures/Truyen/Large/x.jpg",
      "https://img06.g5img.top/bbdata/a/1.jpg",
      "https://img2.truyensieuhay.com/bbdata/a/0.jpg",
      "https://1.bp.blogspot.com/-a/b/s0/0.jpg",
      "https://blogger.googleusercontent.com/img/b/a/s0/1.jpg",
    ]) {
      expect(isAllowedImageHost(adapter, url), url).toBe(true);
    }
    expect(isAllowedImageHost(adapter, "https://evil.example.com/x.jpg")).toBe(false);
  });

  it("dò số chương mở bằng ít request (mốc 5 chương, rồi tìm nhị phân)", async () => {
    const run = async (count: number, free: number) => {
      const checked: number[] = [];
      const result = await countFreePrefix(count, async (i) => (checked.push(i), i < free));
      return { result, requests: checked.length };
    };
    expect(await run(117, 5)).toEqual({ result: 5, requests: 3 });
    expect(await run(41, 41)).toEqual({ result: 41, requests: 1 });
    expect(await run(3821, 2160)).toMatchObject({ result: 2160 });
    expect((await run(3821, 2160)).requests).toBeLessThanOrEqual(15);
    expect(await run(30, 0)).toMatchObject({ result: 0 });
    expect(await run(1, 0)).toEqual({ result: 0, requests: 1 });
    expect(await run(0, 0)).toEqual({ result: 0, requests: 0 });
  });
});
