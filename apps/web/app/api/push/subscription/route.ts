import { prisma } from "@truyen/db";
import { getSession } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";

const MAX_FIELD = 1000;

/** Đăng ký Web Push từ trình duyệt (PushSubscription.toJSON()) — chỉ nhận dịch vụ push qua https. */
function parse(body: unknown) {
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b?.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b?.keys?.auth === "string" ? b.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  if ([endpoint, p256dh, auth].some((v) => v.length > MAX_FIELD)) return null;
  return { endpoint, p256dh, auth };
}

/** Bật thông báo chương mới cho trình duyệt này (gắn với tài khoản đang đăng nhập). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const userId = session.user.id;
  if (!(await allow(`push:${userId}`, 20, 3600))) {
    return Response.json({ error: "Thao tác quá nhiều, thử lại sau" }, { status: 429 });
  }
  const sub = parse(await request.json().catch(() => null));
  if (!sub) return Response.json({ error: "Dữ liệu đăng ký không hợp lệ" }, { status: 400 });

  // Một trình duyệt (endpoint) chỉ thuộc một tài khoản — đăng nhập tài khoản khác thì chuyển sang tài khoản đó.
  await prisma.webPushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, ...sub },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth },
  });
  return Response.json({ ok: true });
}

/** Tắt thông báo cho trình duyệt này. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { endpoint } = ((await request.json().catch(() => null)) ?? {}) as { endpoint?: unknown };
  if (typeof endpoint !== "string") return Response.json({ error: "Thiếu endpoint" }, { status: 400 });
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  return Response.json({ ok: true });
}
