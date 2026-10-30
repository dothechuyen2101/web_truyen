import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@truyen/db";
import { getAdapter, isAllowedImageHost } from "@truyen/crawler";

async function getSources() {
  "use cache";
  cacheLife("minutes");
  cacheTag("sources");
  return prisma.source.findMany({ select: { key: true, baseUrl: true, rateLimitMs: true } });
}

/** Adapter của nguồn sở hữu host ảnh này, hoặc null nếu host không nằm trong whitelist. */
export async function adapterForImage(imageUrl: string) {
  for (const source of await getSources()) {
    try {
      const adapter = getAdapter(source);
      if (isAllowedImageHost(adapter, imageUrl)) return adapter;
    } catch {
      // Nguồn trong DB chưa có adapter — bỏ qua.
    }
  }
  return null;
}
