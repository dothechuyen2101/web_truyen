import { BookOpenText } from "lucide-react";
import { googleEnabled } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { AuthForm } from "./auth-form";
import { PageTransition } from "./motion";

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signingUp = mode === "sign-up";
  return (
    <PageTransition>
      <div className="relative flex min-h-[calc(100vh-12rem)] items-center justify-center overflow-hidden px-4 py-12">
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[520px] -translate-1/2 rounded-full bg-brand opacity-15 blur-3xl" />
        <div className="w-full max-w-sm animate-in rounded-3xl border bg-card/90 p-7 shadow-xl backdrop-blur duration-500 fade-in zoom-in-95">
          <div className="mb-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-primary/30">
              <BookOpenText className="size-6" />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">{signingUp ? "Tạo tài khoản" : "Chào mừng trở lại"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {signingUp
                ? `Theo dõi truyện, bình luận và đồng bộ tủ truyện trên ${SITE_NAME}`
                : "Đăng nhập để tiếp tục đọc truyện"}
            </p>
          </div>
          <AuthForm mode={mode} googleEnabled={googleEnabled} />
        </div>
      </div>
    </PageTransition>
  );
}
