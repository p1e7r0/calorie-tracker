self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : { title: "Bilancia", body: "", url: "/" };
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
