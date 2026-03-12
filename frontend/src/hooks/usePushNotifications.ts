import { useEffect, useRef } from 'react';
import api from '../services/api';
import { getFcmToken, getFirebaseMessaging, onForegroundMessage } from '../config/firebase';

/**
 * Hook to subscribe the current user to FCM push notifications.
 * Call this once after the customer logs in.
 * Uses Firebase Cloud Messaging for cross-platform support (Android + iOS).
 *
 * @param vapidPublicKey - Firebase VAPID key (from Firebase Console > Cloud Messaging > Web Push certificates)
 * @param isLoggedIn - Whether user is logged in
 */
export function usePushNotifications(vapidPublicKey: string | undefined, isLoggedIn: boolean) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !vapidPublicKey || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    const subscribe = async () => {
      try {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get FCM token
        const fcmToken = await getFcmToken(vapidPublicKey);
        if (!fcmToken) return;

        // Send FCM token to backend
        await api.post('/customer/push-subscribe.php', {
          action: 'subscribe',
          fcm_token: fcmToken,
        });

        subscribedRef.current = true;

        // Listen for foreground messages (show in-app toast or similar)
        const messaging = await getFirebaseMessaging();
        if (messaging) {
          onForegroundMessage((payload) => {
            // Show browser notification for foreground messages
            if (payload.notification) {
              const { title, body } = payload.notification;
              if (title) {
                new Notification(title, {
                  body: body || '',
                  icon: '/icons/icon-192.png',
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('Push subscription failed:', err);
      }
    };

    // Small delay to avoid blocking page load
    const timer = setTimeout(subscribe, 3000);
    return () => clearTimeout(timer);
  }, [vapidPublicKey, isLoggedIn]);
}
