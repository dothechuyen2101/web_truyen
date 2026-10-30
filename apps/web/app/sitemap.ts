import type { MetadataRoute } from "next";
import { getGenres } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

/** Các trang cố định và thể loại; trang truyện nằm ở /truyen/sitemap/[id].xml */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const genres = await getGenres();
  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/truyen-chu`, changeFrequency: "hourly" },
    { url: `${SITE_URL}/truyen-tranh`, changeFrequency: "hourly" },
    { url: `${SITE_URL}/the-loai`, changeFrequency: "weekly" },
    ...genres.map((g) => ({ url: `${SITE_URL}/the-loai/${g.slug}`, changeFrequency: "daily" as const })),
  ];
}
