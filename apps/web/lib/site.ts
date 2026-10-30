export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Kho Truyện";
/** Tên miền production của project trên Vercel (tên miền riêng ngắn nhất, không có thì *.vercel.app) */
const VERCEL_PRODUCTION_HOST =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

/**
 * URL công khai: dùng giá trị cấu hình, trừ khi đang chạy trên Vercel mà cấu hình vẫn là localhost
 * (hay quên đổi khi dán .env lên Vercel) — khi đó dùng tên miền production để canonical, sitemap, đăng nhập đúng.
 */
export function publicUrl(configured: string | undefined): string {
  const isLocal = !configured || /\/\/(localhost|127\.0\.0\.1)\b/.test(configured);
  const url = isLocal && VERCEL_PRODUCTION_HOST ? `https://${VERCEL_PRODUCTION_HOST}` : (configured ?? "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export const SITE_URL = publicUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_DESCRIPTION =
  "Đọc truyện chữ và truyện tranh online miễn phí, cập nhật chương mới liên tục mỗi ngày.";

/**
 * Quảng cáo của site (thay ảnh quảng cáo nguồn chèn vào chương). Tắt vì điều kiện dùng API MangaDex cấm
 * mọi quảng cáo/dịch vụ thu phí trên toàn site (và gói Vercel Hobby chỉ cho dùng phi thương mại).
 * Ảnh quảng cáo của nguồn vẫn được nhận diện và ẩn đi.
 */
export const HOUSE_ADS_ENABLED = false;

export const NAV_LINKS = [
  { href: "/truyen-chu", label: "Truyện chữ" },
  { href: "/truyen-tranh", label: "Truyện tranh" },
  { href: "/the-loai", label: "Thể loại" },
  { href: "/tu-truyen", label: "Tủ truyện" },
] as const;
