// Service worker: nhận thông báo đẩy chương mới và mở đúng chương khi bấm vào.
// Không cache trang hay ảnh (tránh hiển thị nội dung cũ) — chỉ phục vụ thông báo và cài đặt PWA.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Kho Truyện", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Kho Truyện", {
      body: data.body || "Có chương mới",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Đã mở site thì chuyển tab đó sang chương mới, chưa thì mở tab mới.
      const tab = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (tab) return tab.navigate(url).then((c) => (c ?? tab).focus());
      return self.clients.openWindow(url);
    }),
  );
});
