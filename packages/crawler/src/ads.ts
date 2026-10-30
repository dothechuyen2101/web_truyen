import { prisma } from "@truyen/db";
import { getAdapter, isAllowedImageHost } from "./adapters";
import { HttpClient } from "./http";
import { SAME_IMAGE_MAX_DISTANCE, dHash, hammingDistance } from "./image-hash";

/** Quảng cáo nguồn chèn thường nằm ở vài ảnh đầu và cuối chương — chỉ kiểm tra các ảnh này. */
const EDGE_IMAGES = 3;

let http: HttpClient | undefined;

/** Tải ảnh của nguồn (kèm Referer của nguồn sở hữu host ảnh) rồi tính dHash. */
export async function fingerprintImage(imageUrl: string): Promise<string> {
  const sources = await prisma.source.findMany();
  const adapter = sources
    .map((s) => {
      try {
        return getAdapter(s);
      } catch {
        return null;
      }
    })
    .find((a) => a && isAllowedImageHost(a, imageUrl));
  if (!adapter) throw new Error("Ảnh không thuộc nguồn nào đã cấu hình");
  http ??= new HttpClient({ retries: 1, minIntervalMs: 200 });
  return dHash(await http.getBuffer(imageUrl, { headers: adapter.imageHeaders(imageUrl) }));
}

function edgeIndexes(count: number): number[] {
  const indexes = new Set<number>();
  for (let i = 0; i < Math.min(EDGE_IMAGES, count); i++) {
    indexes.add(i);
    indexes.add(count - 1 - i);
  }
  return [...indexes].sort((a, b) => a - b);
}

/**
 * Nhận diện ảnh quảng cáo của nguồn trong một chương truyện tranh bằng cách so dHash của
 * các ảnh đầu/cuối với AdFingerprint, rồi lưu vị trí vào ChapterContent.adIndexes.
 */
export async function detectChapterAds(chapterId: number) {
  const content = await prisma.chapterContent.findUnique({ where: { chapterId } });
  const images = Array.isArray(content?.images) ? (content.images as string[]) : [];
  if (!content || !images.length) return { checked: 0, ads: [] as number[] };

  const fingerprints = await prisma.adFingerprint.findMany({ select: { hash: true } });
  const ads: number[] = [];
  if (fingerprints.length) {
    for (const index of edgeIndexes(images.length)) {
      try {
        const hash = await fingerprintImage(images[index]!);
        if (fingerprints.some((f) => hammingDistance(f.hash, hash) <= SAME_IMAGE_MAX_DISTANCE)) ads.push(index);
      } catch {
        // Ảnh lỗi thì bỏ qua, lần quét sau sẽ thử lại.
      }
    }
  }
  await prisma.chapterContent.update({
    where: { chapterId },
    data: { adIndexes: ads, adCheckedAt: new Date() },
  });
  return { checked: images.length ? edgeIndexes(images.length).length : 0, ads };
}
