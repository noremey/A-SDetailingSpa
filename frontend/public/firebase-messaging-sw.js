/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications via FCM
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCdys-Yo0dGps0GXikn1cM2YAptKBN2og4',
  authDomain: 'ansspa-30912.firebaseapp.com',
  projectId: 'ansspa-30912',
  storageBucket: 'ansspa-30912.firebasestorage.app',
  messagingSenderId: '898403421534',
  appId: '1:898403421534:web:9cf90fedbd1c7d5657d3cf',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage(function(payload) {
  const data = payload.notification || payload.data || {};
  const title = data.title || 'ANSSPA';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'ansspa-notification-' + Date.now(),
    data: {
      url: payload.fcmOptions?.link || data.url || '/',
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
