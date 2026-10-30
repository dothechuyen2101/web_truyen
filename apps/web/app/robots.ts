import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { storySitemapCount } from "@/lib/sitemap";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const storySitemaps = await storySitemapCount();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/tim-kiem", "/tu-truyen"] },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: storySitemaps }, (_, i) => `${SITE_URL}/truyen/sitemap/${i}.xml`),
    ],
  };
}
