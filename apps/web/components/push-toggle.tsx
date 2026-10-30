"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PushState = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** iPhone/iPad chỉ nhận thông báo đẩy khi site được "Thêm vào Màn hình chính" (iOS 16.4+). */
function needsIosInstall() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios && !matchMedia("(display-mode: standalone)").matches;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

function usePush() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = VAPID_PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(needsIosInstall() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await registration()).pushManager.getSubscription();
      if (!cancelled) setState(sub ? "on" : "off");
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));
      const res = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không bật được thông báo");
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không bật được thông báo");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Không tắt được thông báo");
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, error, enable, disable };
}

/**
 * Bật/tắt thông báo đẩy khi truyện đang theo dõi có chương mới.
 * `compact`: dòng nhỏ dưới nút Theo dõi; mặc định: khối đầy đủ (trang Tủ truyện).
 */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const { state, busy, error, enable, disable } = usePush();
  if (!session || state === "checking" || state === "unsupported") return null;

  if (compact) {
    if (state === "denied") return null;
    if (state === "ios-install") {
      return (
        <p className="w-full text-xs text-muted-foreground">
          Muốn nhận thông báo chương mới trên iPhone: bấm Chia sẻ → “Thêm vào Màn hình chính”, rồi mở site từ đó.
        </p>
      );
    }
    return (
      <button
        type="button"
        onClick={state === "on" ? disable : enable}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm transition-colors",
          state === "on" ? "text-primary" : "text-muted-foreground hover:text-primary",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : state === "on" ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        {state === "on" ? "Đã bật thông báo chương mới" : "Nhận thông báo khi có chương mới"}
        {error && <span className="text-destructive"> · {error}</span>}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
          {state === "on" ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div>
          <p className="font-semibold">Thông báo chương mới</p>
          <p className="text-sm text-muted-foreground">
            {state === "on" && "Đang bật trên thiết bị này — bạn sẽ nhận thông báo khi truyện đang theo dõi có chương mới."}
            {state === "off" && "Nhận thông báo trên thiết bị này khi truyện bạn theo dõi có chương mới."}
            {state === "denied" && "Trình duyệt đang chặn thông báo của site. Hãy cho phép trong cài đặt trang (biểu tượng ổ khoá cạnh địa chỉ)."}
            {state === "ios-install" &&
              "Trên iPhone/iPad: bấm Chia sẻ → “Thêm vào Màn hình chính”, mở site từ biểu tượng vừa thêm rồi bật thông báo tại đây."}
          </p>
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
      </div>
      {(state === "on" || state === "off") && (
        <Button
          variant={state === "on" ? "outline" : "default"}
          onClick={state === "on" ? disable : enable}
          disabled={busy}
          className={cn("shrink-0 rounded-full", state === "off" && "bg-brand hover:opacity-95")}
        >
          {busy ? <Loader2 className="animate-spin" /> : state === "on" ? <BellOff /> : <Bell />}
          {state === "on" ? "Tắt thông báo" : "Bật thông báo"}
        </Button>
      )}
    </div>
  );
}
