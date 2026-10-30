import { connection } from "next/server";
import { prisma } from "@truyen/db";
import { redis } from "@/lib/redis";

/** Kiểm tra sống cho Docker/uptime monitor: Postgres và Redis đều phải phản hồi. */
export async function GET() {
  await connection();
  const checks = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()]);
  const [db, cache] = checks.map((c) => c.status === "fulfilled");
  const ok = db && cache;
  return Response.json(
    { ok, db, redis: cache },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
