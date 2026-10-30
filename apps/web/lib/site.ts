export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Kho Truyện";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
