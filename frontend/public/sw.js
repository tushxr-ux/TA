// Service Worker for TA Push & Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle clicking on a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/chat');
      }
    })
  );
});

// Handle incoming Web Push events from server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : 'You received a new message' };
  }

  const title = data.title || '💬 TA Message';
  const options = {
    body: data.body || 'You received a new message',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [120, 60, 120],
    data: data.data || { url: '/chat' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
