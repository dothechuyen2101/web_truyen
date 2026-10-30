import { prisma } from "../src/index";

const sources = [
  {
    key: "truyenfull",
    name: "TruyenFull",
    type: "NOVEL",
    baseUrl: "https://truyenfull.live",
    priority: 10,
  },
  {
    key: "nettruyen",
    name: "NetTruyen",
    type: "COMIC",
    baseUrl: "https://nettruyen.gg",
    priority: 10,
  },
  // Nguồn dự phòng: ưu tiên thấp hơn, dùng khi nguồn chính lỗi hoặc thiếu truyện
  {
    key: "truyenqq",
    name: "TruyenQQ",
    type: "COMIC",
    baseUrl: "https://truyenqqko.com",
    priority: 5,
  },
  {
    key: "wetruyen",
    name: "WeTruyen",
    type: "NOVEL",
    baseUrl: "https://wetruyen.com",
    priority: 5,
  },
  // API chính thức, không chặn IP máy chủ (chạy được trên Vercel). Điều kiện: ghi công MangaDex + nhóm dịch,
  // không quảng cáo/thu phí. Giới hạn ~5 request/giây → giãn cách 250ms.
  {
    key: "mangadex",
    name: "MangaDex",
    type: "COMIC",
    baseUrl: "https://api.mangadex.org",
    priority: 20,
    rateLimitMs: 250,
  },
  // Truyện tranh Trung Quốc, không chặn IP máy chủ. Phần lớn chương mới chỉ có trên app của nguồn —
  // adapter chỉ lấy các chương đọc được trên web.
  {
    key: "manhuavn",
    name: "ManhuaVN",
    type: "COMIC",
    baseUrl: "https://manhuavn2.com",
    priority: 12,
    rateLimitMs: 500,
  },
] as const;

for (const s of sources) {
  // Không ghi đè baseUrl/enabled đã chỉnh trong admin.
  await prisma.source.upsert({ where: { key: s.key }, create: s, update: { name: s.name } });
}
console.log(`Đã seed ${sources.length} nguồn`);
await prisma.$disconnect();
