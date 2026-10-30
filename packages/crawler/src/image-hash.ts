import sharp from "sharp";

const SIZE = 8;

/** So từng cặp điểm ảnh liền kề trong lưới xám (cols x rows) theo một chiều, mỗi cặp cho 1 bit. */
function gradientBits(data: Buffer, cols: number, rows: number, horizontal: boolean): bigint {
  let bits = 0n;
  for (let y = 0; y < (horizontal ? rows : rows - 1); y++) {
    for (let x = 0; x < (horizontal ? cols - 1 : cols); x++) {
      const a = data[y * cols + x]!;
      const b = horizontal ? data[y * cols + x + 1]! : data[(y + 1) * cols + x]!;
      bits = (bits << 1n) | (a > b ? 1n : 0n);
    }
  }
  return bits;
}

/**
 * dHash 128-bit (hex 32 ký tự) = dHash ngang 64 bit + dHash dọc 64 bit.
 * Ảnh giống nhau (kể cả khác kích thước/nén lại) cho hash gần nhau theo khoảng cách Hamming;
 * dùng cả hai chiều để không bỏ sót ảnh chỉ khác nhau theo một chiều.
 */
export async function dHash(image: Buffer): Promise<string> {
  const gray = sharp(image).grayscale();
  const [wide, tall] = await Promise.all([
    gray.clone().resize(SIZE + 1, SIZE, { fit: "fill" }).raw().toBuffer(),
    gray.clone().resize(SIZE, SIZE + 1, { fit: "fill" }).raw().toBuffer(),
  ]);
  const horizontal = gradientBits(wide, SIZE + 1, SIZE, true);
  const vertical = gradientBits(tall, SIZE, SIZE + 1, false);
  return horizontal.toString(16).padStart(16, "0") + vertical.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

/** Ngưỡng coi hai ảnh là một (trên 128 bit) */
export const SAME_IMAGE_MAX_DISTANCE = 14;
