import { SITE_URL } from "@/lib/site";
import { chapterSitemapCount, SITEMAP_HEADERS, sitemapIndexXml, storySitemapCount } from "@/lib/sitemap";

/** Sitemap tổng (gửi cái này lên Google Search Console): trang chính, trang truyện, trang chương. */
export async function GET() {
  const [stories, chapters] = await Promise.all([storySitemapCount(), chapterSitemapCount()]);
  const xml = sitemapIndexXml([
    `${SITE_URL}/sitemap.xml`,
    ...Array.from({ length: stories }, (_, i) => `${SITE_URL}/truyen/sitemap/${i}.xml`),
    ...Array.from({ length: chapters }, (_, i) => `${SITE_URL}/sitemaps/chuong-${i}.xml`),
  ]);
  return new Response(xml, { headers: SITEMAP_HEADERS });
}
