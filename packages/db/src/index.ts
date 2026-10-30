import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Pool nhỏ, đóng kết nối rảnh sớm: trên serverless mỗi instance giữ pool riêng, mà pooler Supabase gói miễn phí
 * chỉ nhận tối đa 200 kết nối — pool mặc định của pg (10/instance) cạn nhanh khi nhiều instance chạy song song
 * (vd hàng chục ảnh truyện qua proxy cùng lúc), gây lỗi EMAXCONN.
 */
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 3);
const POOL_IDLE_MS = 5_000;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL chưa được cấu hình");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: POOL_MAX, idleTimeoutMillis: POOL_IDLE_MS }),
  });
}

// Giữ một client duy nhất khi Next.js hot-reload trong dev.
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
