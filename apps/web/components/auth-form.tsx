"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";
import { useHydrated } from "@/lib/use-hydrated";

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email hoặc mật khẩu không đúng",
  USER_ALREADY_EXISTS: "Email này đã được đăng ký",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email này đã được đăng ký",
  PASSWORD_TOO_SHORT: "Mật khẩu phải có ít nhất 8 ký tự",
  INVALID_EMAIL: "Email không hợp lệ",
  BANNED_USER: "Tài khoản của bạn đã bị khoá",
};

function errorMessage(error: { code?: string; status?: number; message?: string }) {
  if (error.status === 429) return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút";
  return (error.code && ERRORS[error.code]) || error.message || "Có lỗi xảy ra, vui lòng thử lại";
}

/** Chỉ cho phép chuyển về đường dẫn nội bộ sau khi đăng nhập. */
function redirectTarget() {
  const target = new URLSearchParams(location.search).get("redirect");
  return target?.startsWith("/") && !target.startsWith("//") ? target : "/";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.8 2.4 2.6 6.6 2.6 11.9S6.8 21.4 12 21.4c6.9 0 9.2-4.8 9.2-7.3 0-.5-.1-.9-.1-1.3H12z" />
    </svg>
  );
}

export function AuthForm({ mode, googleEnabled }: { mode: "sign-in" | "sign-up"; googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const signingUp = mode === "sign-up";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    startTransition(async () => {
      if (signingUp && password !== form.get("confirm")) {
        setError("Mật khẩu nhập lại không khớp");
        return;
      }
      const res = signingUp
        ? await signUp.email({ email, password, name: String(form.get("name") ?? "").trim() })
        : await signIn.email({ email, password });
      if (res.error) {
        setError(errorMessage(res.error));
        return;
      }
      router.push(redirectTarget());
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => signIn.social({ provider: "google", callbackURL: redirectTarget() })}
          >
            <GoogleIcon /> Tiếp tục với Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> hoặc <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {/* method="post": nếu bị gửi trước khi JS chạy, mật khẩu không lọt vào URL */}
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {signingUp && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên hiển thị</Label>
            <Input id="name" name="name" required minLength={2} maxLength={50} autoComplete="nickname" className="h-11 rounded-xl" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signingUp ? "new-password" : "current-password"}
            className="h-11 rounded-xl"
          />
        </div>
        {signingUp && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Nhập lại mật khẩu</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="h-11 rounded-xl" />
          </div>
        )}
        {error && (
          <p role="alert" className="animate-in rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending || !hydrated}
          className="h-11 w-full rounded-xl bg-brand text-base shadow-lg shadow-primary/25 hover:opacity-95"
        >
          {pending && <Loader2 className="animate-spin" />}
          {signingUp ? "Tạo tài khoản" : "Đăng nhập"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {signingUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link href={signingUp ? "/dang-nhap" : "/dang-ky"} className="font-medium text-primary hover:underline">
          {signingUp ? "Đăng nhập" : "Đăng ký ngay"}
        </Link>
      </p>
    </div>
  );
}
