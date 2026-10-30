import { describe, expect, it } from "vitest";
import { chapterPayload } from "../src/push-payload";

describe("notify", () => {
  it("nội dung thông báo chương mới: tên truyện, số chương, link tới chương", () => {
    expect(chapterPayload({ slug: "dai-quan-gia-la-ma-hoang", title: "Đại Quản Gia Là Ma Hoàng" }, { number: 929, title: null })).toEqual({
      title: "Đại Quản Gia Là Ma Hoàng",
      body: "Đã có chương 929 — đọc ngay!",
      url: "/truyen/dai-quan-gia-la-ma-hoang/chuong-929",
      tag: "story-dai-quan-gia-la-ma-hoang",
    });
  });

  it("chương lẻ và có tên chương", () => {
    const payload = chapterPayload({ slug: "x", title: "X" }, { number: 136.5, title: "Ngoại truyện" });
    expect(payload.body).toBe("Đã có chương 136.5: Ngoại truyện — đọc ngay!");
    expect(payload.url).toBe("/truyen/x/chuong-136.5");
  });
});
