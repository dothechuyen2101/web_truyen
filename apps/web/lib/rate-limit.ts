import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@truyen/db";

/**
 * Đếm số lần trong cửa sổ thời gian cố định; trả về false nếu vượt giới hạn.
 * Dùng chung bảng rateLimit với Better Auth (khoá có tiền tố "app:"), cập nhật nguyên tử bằng một câu SQL.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = BigInt(Date.now());
  const windowStart = now - BigInt(windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rateLimit" (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${`app:${key}`}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "rateLimit"."lastRequest" < ${windowStart} THEN 1 ELSE "rateLimit".count + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${windowStart} THEN ${now} ELSE "rateLimit"."lastRequest" END
    RETURNING count`;
  return Number(rows[0]?.count ?? 0) <= limit;
}
