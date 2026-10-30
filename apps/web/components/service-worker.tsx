"use client";

import { useEffect } from "react";

/** Đăng ký service worker (thông báo đẩy, cài site như app). Không cache nội dung nên không gây hiển thị bản cũ. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
