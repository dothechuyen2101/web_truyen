import { describe, expect, it } from "vitest";
import { ensureUniqueNumbers } from "../src/adapters/base";
import { isAllowedImageHost, NettruyenAdapter } from "../src/adapters";
import { HttpClient } from "../src/http";
import { cleanContentHtml, joinDottedWords, stripAuthorSuffix } from "../src/normalize";

describe("normalize", () => {
  it("gộp chữ bị chèn dấu chấm nhưng giữ viết tắt ngắn", () => {
    expect(joinDottedWords("cá c.h.ế.t lưới rách, đ.â.m vào, v.v.")).toBe("cá chết lưới rách, đâm vào, v.v.");
  });

  it("chỉ giữ thẻ định dạng an toàn", () => {
    expect(cleanContentHtml('<p onclick="x()">A<script>alert(1)</script></p><p> </p><a href="//x">B</a>')).toBe(
      "<p>A</p>B",
    );
  });

  it("bỏ tên tác giả ở cuối tiêu đề", () => {
    expect(stripAuthorSuffix("Tháng Tư Ôn Hòa - Mộng Tiêu Nhị", "Mộng Tiêu Nhị")).toBe("Tháng Tư Ôn Hòa");
    expect(stripAuthorSuffix("Freud Của Anh Ấy – Mộng Tiêu Nhị", "Mộng Tiêu Nhị")).toBe("Freud Của Anh Ấy");
    expect(stripAuthorSuffix("Cố Chấp", undefined)).toBe("Cố Chấp");
  });

  it("đánh lại số chương khi nguồn có số trùng", () => {
    const refs = [
      { path: "/a/quyen-1-chuong-1", number: 1 },
      { path: "/a/quyen-2-chuong-1", number: 1 },
    ];
    expect(ensureUniqueNumbers(refs).map((c) => c.number)).toEqual([1, 2]);
  });

  it("chương thiếu số: lấy từ tiêu đề hoặc chèn số lẻ, không đánh lại cả danh sách", () => {
    const refs = [
      { path: "/a/c-3", number: 3 },
      { path: "/a/ngoai-truyen", number: Number.NaN, title: "Ngoại truyện" },
      { path: "/a/c-2-5", number: Number.NaN, title: "Chương 2.5" },
      { path: "/a/c-2", number: 2 },
      { path: "/a/c-1", number: 1 },
    ];
    expect(ensureUniqueNumbers(refs).map((c) => [c.path, c.number])).toEqual([
      ["/a/c-1", 1],
      ["/a/c-2", 2],
      ["/a/c-2-5", 2.5],
      ["/a/ngoai-truyen", 2.51],
      ["/a/c-3", 3],
    ]);
  });

  it("kiểm tra host ảnh theo whitelist của adapter", () => {
    const adapter = new NettruyenAdapter({ baseUrl: "https://nettruyen.gg", http: new HttpClient() });
    expect(isAllowedImageHost(adapter, "https://image1.kcgsbok.com/a.jpg")).toBe(true);
    expect(isAllowedImageHost(adapter, "https://evilkcgsbok.com/a.jpg")).toBe(false);
    expect(isAllowedImageHost(adapter, "http://169.254.169.254/latest")).toBe(false);
  });
});
