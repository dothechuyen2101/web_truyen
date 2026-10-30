import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false } };

export default function SignInPage() {
  return <AuthPage mode="sign-in" />;
}
