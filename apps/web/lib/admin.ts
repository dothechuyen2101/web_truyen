import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession, isAdmin } from "./auth";

/** Dùng trong trang admin: chưa đăng nhập → trang đăng nhập; không phải admin → 404 (không lộ trang quản trị). */
export async function requireAdmin(path = "/admin") {
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=${encodeURIComponent(path)}`);
  if (!isAdmin(session.user)) notFound();
  return session.user;
}

/** Dùng trong Server Action của admin. */
export async function assertAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) throw new Error("Bạn không có quyền thực hiện thao tác này");
  return session.user;
}

/** Mốc thời gian cách đây `hours` giờ (trang admin luôn render động nên dùng giờ hiện tại được). */
export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000);
}

export type ActionState = { ok: boolean; message: string } | null;

export function actionError(error: unknown): ActionState {
  return { ok: false, message: error instanceof Error ? error.message : "Có lỗi xảy ra" };
}
