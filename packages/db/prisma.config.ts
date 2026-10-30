import { defineConfig, env } from "prisma/config";

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
    url: env("DATABASE_URL"),
  },
});
