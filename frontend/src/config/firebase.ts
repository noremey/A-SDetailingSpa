/**
 * Firebase Configuration
 * Used for Firebase Cloud Messaging (push notifications)
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCdys-Yo0dGps0GXikn1cM2YAptKBN2og4',
  authDomain: 'ansspa-30912.firebaseapp.com',
  projectId: 'ansspa-30912',
  storageBucket: 'ansspa-30912.firebasestorage.app',
  messagingSenderId: '898403421534',
  appId: '1:898403421534:web:9cf90fedbd1c7d5657d3cf',
};

const app = initializeApp(firebaseConfig);

// Messaging instance (lazy-initialized, only on supported browsers)
let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Get FCM device token for this browser
 * Requires notification permission + active service worker
 */
export async function getFcmToken(vapidKey: string): Promise<string | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.warn('FCM: Failed to get token:', err);
    return null;
  }
}

/**
 * Listen for foreground messages (when app is open)
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messagingInstance) return null;
  const unsubscribe = onMessage(messagingInstance, callback);
  return unsubscribe;
}

export { app };
