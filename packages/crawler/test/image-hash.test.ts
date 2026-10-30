import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SAME_IMAGE_MAX_DISTANCE, dHash, hammingDistance } from "../src/image-hash";

/** Ảnh thử: các dải màu ngang, giả lập một banner quảng cáo. */
function banner(width: number, height: number, colors: string[]) {
  const band = Math.ceil(height / colors.length);
  return sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(
      colors.map((c, i) => ({
        input: { create: { width, height: band, channels: 3 as const, background: c } },
        top: i * band,
        left: 0,
      })),
    )
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("image-hash", () => {
  it("cùng một ảnh khác kích thước và chất lượng nén cho hash gần nhau", async () => {
    const original = await banner(800, 1200, ["#111", "#e33", "#fd3", "#3a3", "#33c", "#eee"]);
    const resized = await sharp(original).resize(400, 600).jpeg({ quality: 60 }).toBuffer();
    const distance = hammingDistance(await dHash(original), await dHash(resized));
    expect(distance).toBeLessThanOrEqual(SAME_IMAGE_MAX_DISTANCE);
  });

  it("hai ảnh khác nhau cho hash cách xa", async () => {
    const a = await banner(800, 1200, ["#111", "#e33", "#fd3", "#3a3", "#33c", "#eee"]);
    const b = await banner(800, 1200, ["#eee", "#33c", "#3a3", "#fd3", "#e33", "#111"]);
    expect(hammingDistance(await dHash(a), await dHash(b))).toBeGreaterThan(SAME_IMAGE_MAX_DISTANCE);
  });

  it("đếm bit khác nhau", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hammingDistance("f".repeat(32), "0".repeat(32))).toBe(128);
  });
});

describe("image-hash: ảnh chỉ khác theo chiều ngang", () => {
  it("vẫn phân biệt được nhờ dHash dọc + ngang", async () => {
    const vertical = (colors: string[]) => {
      const w = Math.ceil(800 / colors.length);
      return sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } })
        .composite(
          colors.map((c, i) => ({
            input: { create: { width: w, height: 600, channels: 3 as const, background: c } },
            top: 0,
            left: i * w,
          })),
        )
        .png()
        .toBuffer();
    };
    const a = await vertical(["#000", "#fff", "#000", "#fff"]);
    const b = await vertical(["#fff", "#000", "#fff", "#000"]);
    expect(hammingDistance(await dHash(a), await dHash(b))).toBeGreaterThan(SAME_IMAGE_MAX_DISTANCE);
  });
});
