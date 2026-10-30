import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Đăng ký", robots: { index: false } };

export default function SignUpPage() {
  return <AuthPage mode="sign-up" />;
}
