import { defineConfig } from "prisma/config";

// .env dùng chung nằm ở gốc monorepo; khi deploy biến môi trường được set sẵn nên bỏ qua nếu không có file.
try {
  process.loadEnvFile("../../.env");
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrate cần phiên kết nối ổn định: dùng DIRECT_URL (Supabase: pooler chế độ session) nếu có.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
