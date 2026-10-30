import { describe, expect, it } from "vitest";
import {
  parseMangadexAtHome,
  parseMangadexChapters,
  parseMangadexLatest,
  parseMangadexStory,
} from "../src/adapters/mangadex";
import { fixture } from "./helpers";

const json = (name: string) => JSON.parse(fixture(`mangadex/${name}.json`));
const MANGA = "/manga/879af0bb-ce30-47e4-a74e-cd1ce874c6e3";

/** Chương tự dựng cho các tình huống fixture thật không có */
function chapter(id: string, number: string | null, group?: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    attributes: {
      chapter: number,
      title: null,
      externalUrl: null,
      isUnavailable: false,
      pages: 10,
      readableAt: `2026-01-${id.padStart(2, "0")}T00:00:00+00:00`,
      ...extra,
    },
    relationships: group ? [{ id: `g-${group}`, type: "scanlation_group", attributes: { name: group } }] : [],
  };
}

describe("mangadex", () => {
  it("gom chương mới đăng thành danh sách truyện, ưu tiên tên tiếng Việt", () => {
    const { items, hasNext } = parseMangadexLatest(json("recent"));
    expect(hasNext).toBe(true);
    expect(items).toHaveLength(21);
    expect(items[0]).toEqual({
      path: "/manga/29ab6984-7c1d-4d45-b925-25aa082b492e",
      title: "Shangri-La Frontier ~ Thợ săn game rác thách thức game thánh",
      latestChapter: 285,
    });
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
  });

  it("bỏ truyện có tag bị loại trừ, dừng ở mốc offset tối đa của API", () => {
    const manga = (tags: string[]) => ({
      id: "m1",
      type: "manga",
      attributes: {
        title: { en: "X" },
        altTitles: [],
        tags: tags.map((name) => ({ attributes: { name: { en: name }, group: "theme" } })),
      },
    });
    const page = (offset: number, tags: string[]) => ({
      data: [{ ...chapter("1", "1"), relationships: [manga(tags)] }],
      limit: 100,
      offset,
      total: 50_000,
    });
    expect(parseMangadexLatest(page(0, ["Loli"])).items).toEqual([]);
    expect(parseMangadexLatest(page(0, ["Magic"])).items).toHaveLength(1);
    expect(parseMangadexLatest(page(9_800, [])).hasNext).toBe(true);
    expect(parseMangadexLatest(page(9_900, [])).hasNext).toBe(false);
  });

  it("đọc thông tin truyện: tên Việt, thể loại map sang tên của site, ảnh bìa trên uploads.mangadex.org", () => {
    const story = parseMangadexStory(json("manga"), MANGA);
    expect(story.title).toBe("Cuộc Sống Nông Dân Ở Thế Giới Khác");
    expect(story.altTitles).toContain("Isekai Nonbiri Nouka");
    expect(story.altTitles).toContain("Farming Life in Another World");
    expect(story.altTitles).not.toContain(story.title);
    expect(story.author).toBe("Naitou Kinosuke");
    expect(story.genres).toEqual(["Comedy", "Adventure", "Harem", "Isekai", "Fantasy", "Slice of Life", "Manga"]);
    expect(story.status).toBe("ONGOING");
    expect(story.coverUrl).toBe(
      "https://uploads.mangadex.org/covers/879af0bb-ce30-47e4-a74e-cd1ce874c6e3/710ddb8e-e242-4648-8ff3-c09fa48636b4.jpg.512.jpg",
    );
    expect(story.description).toMatch(/^<p>Having died of sickness/);
  });

  it("chuyển mô tả Markdown thành đoạn văn, bỏ link và đường kẻ", () => {
    const data = json("manga");
    data.data.attributes.description = {
      vi: "**Tóm tắt**: một câu chuyện.\n\n---\n- [Trang chính thức](https://example.com)",
    };
    expect(parseMangadexStory(data, MANGA).description).toBe("<p>Tóm tắt: một câu chuyện.</p><p>Trang chính thức</p>");
  });

  it("đọc feed chương kèm nhóm dịch để ghi công", () => {
    const chapters = parseMangadexChapters(json("feed").data);
    expect(chapters).toHaveLength(80);
    expect(chapters[0]).toEqual({
      path: "/chapter/a2458b55-2e43-42b2-8dd7-490884866083",
      number: 1,
      title: undefined,
      credit: "Idaina Hikari",
    });
    expect(chapters.map((c) => c.number)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
  });

  it("chương nhiều nhóm dịch: giữ nhóm dịch nhiều chương hơn; bỏ chương bị gỡ/link ngoài; oneshot vẫn giữ", () => {
    const chapters = parseMangadexChapters([
      chapter("1", "1", "A"),
      chapter("2", "1.0", "B"),
      chapter("3", "2", "B"),
      chapter("4", "3", "B"),
      chapter("5", "4", "A", { isUnavailable: true }),
      chapter("6", "5", "A", { externalUrl: "https://mangaplus.example/5" }),
      chapter("7", null, "C"),
    ]);
    expect(chapters.map((c) => [c.number, c.path, c.credit])).toEqual([
      [1, "/chapter/2", "B"],
      [2, "/chapter/3", "B"],
      [3, "/chapter/4", "B"],
      [3.01, "/chapter/7", "C"],
    ]);
    expect(chapters.at(-1)?.title).toBe("Oneshot");
  });

  it("ảnh chương: URL máy chủ gốc chất lượng data-saver, không dùng node MangaDex@Home tạm thời", () => {
    const content = parseMangadexAtHome(json("athome"));
    expect(content.kind).toBe("images");
    if (content.kind !== "images") return;
    expect(content.urls).toHaveLength(27);
    expect(content.urls[0]).toBe(
      "https://uploads.mangadex.org/data-saver/a08da38935c487cede625d5ead92f942/1-6e20274a351d3b808d7e5bc4fa426e6e5e0d8bf5a229fc5cff6c92143e3a9169.jpg",
    );
    expect(content.urls.every((u) => !u.includes("mangadex.network"))).toBe(true);
  });
});
