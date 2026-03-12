<?php
/**
 * Customer Push Subscription Management
 * Supports both FCM tokens (new) and VAPID subscriptions (legacy)
 *
 * POST action=subscribe   — Save push subscription (FCM or VAPID)
 * POST action=unsubscribe — Remove push subscription
 */
require_once __DIR__ . '/../config/app.php';

$user = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$action = sanitizeString($input['action'] ?? '');
$db = getDB();

if ($action === 'subscribe') {
    $fcmToken = sanitizeString($input['fcm_token'] ?? '');

    if ($fcmToken) {
        // ── FCM Token subscription ──
        $stmt = $db->prepare("
            INSERT INTO push_subscriptions (user_id, fcm_token, created_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = NOW()
        ");
        $stmt->execute([$user['user_id'], $fcmToken]);

        apiResponse(true, null, 'FCM subscription saved');
    } else {
        // ── Legacy VAPID subscription (fallback) ──
        $endpoint = sanitizeString($input['endpoint'] ?? '');
        $p256dh   = sanitizeString($input['p256dh'] ?? '');
        $auth     = sanitizeString($input['auth'] ?? '');

        if (!$endpoint || !$p256dh || !$auth) {
            apiResponse(false, null, 'Missing subscription data');
        }

        $stmt = $db->prepare("
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)
        ");
        $stmt->execute([$user['user_id'], $endpoint, $p256dh, $auth]);

        apiResponse(true, null, 'Subscription saved');
    }

} elseif ($action === 'unsubscribe') {
    $fcmToken = sanitizeString($input['fcm_token'] ?? '');
    $endpoint = sanitizeString($input['endpoint'] ?? '');

    if ($fcmToken) {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE fcm_token = ? AND user_id = ?");
        $stmt->execute([$fcmToken, $user['user_id']]);
    } elseif ($endpoint) {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?");
        $stmt->execute([$endpoint, $user['user_id']]);
    }

    apiResponse(true, null, 'Subscription removed');

} else {
    apiResponse(false, null, 'Invalid action');
}
