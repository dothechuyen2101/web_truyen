import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { storySitemapCount, storySitemapEntries } from "@/lib/sitemap";

export async function generateSitemaps() {
  const count = await storySitemapCount();
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const stories = await storySitemapEntries(Number(await props.id));
  return stories.map((s) => ({
    url: `${SITE_URL}/truyen/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "daily",
  }));
}
