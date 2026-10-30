import "server-only";
import { redis } from "./redis";

/** Đếm số lần trong cửa sổ thời gian; trả về false nếu vượt giới hạn. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const k = `ratelimit:${key}`;
  const result = await redis.multi().incr(k).expire(k, windowSeconds, "NX").exec();
  return Number(result?.[0]?.[1] ?? 0) <= limit;
}
