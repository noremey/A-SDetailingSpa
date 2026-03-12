// Service Worker - PWA + Push Notifications (FCM + Legacy VAPID)
const CACHE_NAME = 'loyalty-rewards-v3';

// Import Firebase SDKs for background message handling
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
    apiKey: 'AIzaSyCdys-Yo0dGps0GXikn1cM2YAptKBN2og4',
    authDomain: 'ansspa-30912.firebaseapp.com',
    projectId: 'ansspa-30912',
    storageBucket: 'ansspa-30912.firebasestorage.app',
    messagingSenderId: '898403421534',
    appId: '1:898403421534:web:9cf90fedbd1c7d5657d3cf',
});

const messaging = firebase.messaging();

// Handle FCM background messages
messaging.onBackgroundMessage((payload) => {
    const data = payload.notification || payload.data || {};
    const title = data.title || 'ANSSPA';
    const options = {
        body: data.body || '',
        icon: data.icon || '/users/api/logo-proxy.php',
        badge: '/users/api/logo-proxy.php',
        data: { url: payload.fcmOptions?.link || data.url || '/users/' },
        vibrate: [200, 100, 200],
        tag: 'loyalty-notification',
        renotify: true,
    };
    return self.registration.showNotification(title, options);
});

// Install event
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

// Fetch event - network first, simple pass-through
self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ============================================
// Legacy VAPID Push (fallback)
// ============================================
self.addEventListener('push', (e) => {
    if (!e.data) return;

    let data;
    try {
        data = e.data.json();
    } catch (err) {
        data = { title: 'Notification', body: e.data.text() };
    }

    // Skip if FCM message (already handled by onBackgroundMessage)
    if (data.fcmMessageId || data.from) return;

    const options = {
        body: data.body || '',
        icon: data.icon || '/users/api/logo-proxy.php',
        badge: data.icon || '/users/api/logo-proxy.php',
        data: { url: data.url || '/users/' },
        vibrate: [200, 100, 200],
        tag: 'loyalty-notification',
        renotify: true,
    };

    e.waitUntil(
        self.registration.showNotification(data.title || 'Notification', options)
    );
});

// ============================================
// Notification Clicked - Open App
// ============================================
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = e.notification.data?.url || '/users/';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes('/users/') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
