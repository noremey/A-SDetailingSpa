/**
 * Push Notification Handler for Service Worker
 * This file is imported by the Workbox service worker via importScripts
 * Supports both Firebase Cloud Messaging and legacy VAPID push
 */

// Import Firebase SDKs for background message handling
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: 'AIzaSyCdys-Yo0dGps0GXikn1cM2YAptKBN2og4',
  authDomain: 'ansspa-30912.firebaseapp.com',
  projectId: 'ansspa-30912',
  storageBucket: 'ansspa-30912.firebasestorage.app',
  messagingSenderId: '898403421534',
  appId: '1:898403421534:web:9cf90fedbd1c7d5657d3cf',
});

var messaging = firebase.messaging();

// Handle FCM background messages
messaging.onBackgroundMessage(function(payload) {
  var data = payload.notification || payload.data || {};
  var title = data.title || 'ANSSPA';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'ansspa-notification-' + Date.now(),
    data: {
      url: (payload.fcmOptions && payload.fcmOptions.link) || data.url || '/',
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  return self.registration.showNotification(title, options);
});

// Handle legacy VAPID push (fallback)
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Notification', body: event.data.text() };
  }

  // Skip if FCM message (already handled by onBackgroundMessage)
  if (data.fcmMessageId || data.from) return;

  var title = data.title || 'ANSSPA';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'ansspa-notification-' + Date.now(),
    data: {
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
