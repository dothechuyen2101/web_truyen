import { connection } from "next/server";
import { prisma } from "@truyen/db";

/** Kiểm tra sống cho uptime monitor: Postgres phải phản hồi. */
export async function GET() {
  await connection();
  const db = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  return Response.json({ ok: db, db }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
