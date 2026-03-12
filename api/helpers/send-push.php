<?php
/**
 * Push Notification Convenience Wrapper
 * Supports Firebase Cloud Messaging (FCM) and legacy VAPID
 * Usage: notifyUser($userId, 'Title', 'Body text', '/users/')
 */

require_once __DIR__ . '/firebase-push.php';
require_once __DIR__ . '/web-push.php';
require_once __DIR__ . '/../config/app.php';

/**
 * Send push notification to all devices of a user
 * Tries FCM first, falls back to VAPID for legacy subscriptions
 *
 * @param int    $userId  Target user ID
 * @param string $title   Notification title
 * @param string $body    Notification body
 * @param string $url     URL to open on click (optional)
 */
function notifyUser(int $userId, string $title, string $body, string $url = '/users/'): void {
    try {
        // Check if push is enabled
        $enabled = getSetting('push_notifications_enabled');
        if ($enabled !== '1') return;

        $db = getDB();
        $stmt = $db->prepare("SELECT id, endpoint, p256dh, auth, fcm_token FROM push_subscriptions WHERE user_id = ?");
        $stmt->execute([$userId]);
        $subscriptions = $stmt->fetchAll();

        if (empty($subscriptions)) return;

        // Get business logo for notification icon
        $logo = getSetting('business_logo') ?: '';

        foreach ($subscriptions as $sub) {
            try {
                if (!empty($sub['fcm_token'])) {
                    // ── FCM Push ──
                    $httpCode = sendFcmNotification(
                        $sub['fcm_token'],
                        $title,
                        $body,
                        $url,
                        $logo
                    );

                    // Remove stale FCM tokens
                    if ($httpCode === 410 || $httpCode === 404) {
                        $delStmt = $db->prepare("DELETE FROM push_subscriptions WHERE id = ?");
                        $delStmt->execute([$sub['id']]);
                    }
                } elseif (!empty($sub['endpoint'])) {
                    // ── Legacy VAPID Push ──
                    $vapidPublicKey = getSetting('vapid_public_key');
                    $vapidPrivateKey = getSetting('vapid_private_key');
                    if (!$vapidPublicKey || !$vapidPrivateKey) continue;

                    $contactEmail = getSetting('business_email') ?: '';
                    $payload = json_encode([
                        'title' => $title,
                        'body'  => $body,
                        'url'   => $url,
                        'icon'  => $logo,
                    ], JSON_UNESCAPED_UNICODE);

                    $httpCode = sendPushNotification(
                        $sub,
                        $payload,
                        $vapidPublicKey,
                        $vapidPrivateKey,
                        $contactEmail
                    );

                    // Remove stale VAPID subscriptions
                    if ($httpCode === 410 || $httpCode === 404) {
                        $delStmt = $db->prepare("DELETE FROM push_subscriptions WHERE id = ?");
                        $delStmt->execute([$sub['id']]);
                    }
                }
            } catch (\Exception $e) {
                // Silently continue — push should never break business logic
            }
        }
    } catch (\Exception $e) {
        // Silently fail — push notifications are best-effort
    }
}
