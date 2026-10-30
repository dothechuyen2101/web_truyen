import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/tim-kiem", "/tu-truyen"] },
    // Sitemap tổng liệt kê sitemap trang chính, trang truyện và trang chương.
    sitemap: `${SITE_URL}/sitemap-index.xml`,
  };
}
