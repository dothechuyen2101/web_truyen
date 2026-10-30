import "server-only";
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  // lazyConnect: chỉ kết nối khi có lệnh đầu tiên (next build không cần Redis).
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 2, lazyConnect: true });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
