import "server-only";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "@truyen/db";
import { redis } from "./redis";
import { SITE_NAME } from "./site";

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  appName: SITE_NAME,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Session và bộ đếm giới hạn tần suất lưu ở Redis để chạy được nhiều instance web.
  secondaryStorage: {
    get: (key) => redis.get(`auth:${key}`),
    getAndDelete: (key) => redis.getdel(`auth:${key}`),
    // Bộ đếm (giới hạn tần suất): TTL chỉ đặt ở lần tăng đầu tiên của cửa sổ.
    increment: async (key, ttl) => {
      const k = `auth:${key}`;
      const result = await redis.multi().incr(k).expire(k, ttl, "NX").exec();
      return Number(result?.[0]?.[1] ?? 0);
    },
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(`auth:${key}`, value, "EX", ttl);
      else await redis.set(`auth:${key}`, value);
    },
    delete: async (key) => {
      await redis.del(`auth:${key}`);
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
    },
  },
  plugins: [admin(), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

/** Session của request hiện tại (null nếu chưa đăng nhập). Gọi trong Server Action / Route Handler. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Bạn cần đăng nhập để thực hiện thao tác này");
  return session.user;
}

export const isAdmin = (user: { role?: string | null } | null | undefined) => user?.role === "admin";
