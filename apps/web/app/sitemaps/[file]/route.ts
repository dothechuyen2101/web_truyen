import { chapterHref } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { chapterSitemapCount, chapterSitemapEntries, SITEMAP_HEADERS, urlsetXml } from "@/lib/sitemap";

/** Sitemap chương: /sitemaps/chuong-0.xml, chuong-1.xml… (mỗi file một khoảng id chương). */
export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const index = Number((await params).file.match(/^chuong-(\d+)\.xml$/)?.[1] ?? Number.NaN);
  if (!Number.isInteger(index) || index >= (await chapterSitemapCount())) {
    return new Response("Không tìm thấy sitemap", { status: 404 });
  }
  const chapters = await chapterSitemapEntries(index);
  const xml = urlsetXml(
    chapters.map((c) => ({ loc: `${SITE_URL}${chapterHref(c.story.slug, c.number)}`, lastmod: c.createdAt })),
  );
  return new Response(xml, { headers: SITEMAP_HEADERS });
}
