/* Tujjar Market service worker: shows push notifications and opens their page when tapped. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "تُجّار ماركت", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "تُجّار ماركت";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/notifications";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/brand/icon-192.png",
        badge: "/brand/icon-192.png",
        dir: "rtl",
        lang: "ar",
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url },
      });
      // Open tabs refresh their bell counter
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      tabs.forEach((tab) => tab.postMessage({ type: "tujjar-notification" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);

  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = tabs.find((tab) => new URL(tab.url).origin === target.origin);
      if (same) {
        await same.focus();
        if ("navigate" in same) return same.navigate(target.href);
        return undefined;
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
