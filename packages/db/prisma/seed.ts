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
] as const;

for (const s of sources) {
  // Không ghi đè baseUrl/enabled đã chỉnh trong admin.
  await prisma.source.upsert({ where: { key: s.key }, create: s, update: { name: s.name } });
}
console.log(`Đã seed ${sources.length} nguồn`);
await prisma.$disconnect();
