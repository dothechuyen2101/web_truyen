import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Kiểm tra sơ bộ: chưa có cookie đăng nhập thì chuyển sang trang đăng nhập ngay.
 * Quyền admin thật sự được kiểm tra ở từng trang/action (requireAdmin, assertAdmin).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const login = new URL("/dang-nhap", request.url);
    login.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
