self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "ShotSphere";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { entityType: data.entityType, entityId: data.entityId },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // eslint-disable-next-line no-undef
  event.waitUntil(clients.openWindow("/notifications"));
});
