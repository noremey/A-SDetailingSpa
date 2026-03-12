<?php
/**
 * Push Subscription Management
 * Supports both FCM tokens (new) and VAPID subscriptions (legacy)
 * POST: Subscribe (upsert push subscription)
 * DELETE: Unsubscribe (remove push subscription)
 */

require_once __DIR__ . '/config.php';

$userId = requireLogin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $fcmToken = trim($input['fcm_token'] ?? '');

    if ($fcmToken) {
        // ── FCM Token subscription ──
        $stmt = $db->prepare("
            INSERT INTO push_subscriptions (user_id, fcm_token, created_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = NOW()
        ");
        $stmt->execute([$userId, $fcmToken]);

        jsonResponse(true, null, 'FCM subscription saved');
    } else {
        // ── Legacy VAPID subscription ──
        $endpoint = $input['endpoint'] ?? '';
        $p256dh   = $input['keys']['p256dh'] ?? '';
        $auth     = $input['keys']['auth'] ?? '';

        if (empty($endpoint) || empty($p256dh) || empty($auth)) {
            jsonResponse(false, null, 'Invalid subscription data');
        }

        $stmt = $db->prepare("
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), updated_at = NOW()
        ");
        $stmt->execute([$userId, $endpoint, $p256dh, $auth]);

        jsonResponse(true, null, 'Push subscription saved');
    }

} elseif ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $fcmToken = trim($input['fcm_token'] ?? '');
    $endpoint = $input['endpoint'] ?? '';

    if ($fcmToken) {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND fcm_token = ?");
        $stmt->execute([$userId, $fcmToken]);
    } elseif ($endpoint) {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?");
        $stmt->execute([$userId, $endpoint]);
    }

    jsonResponse(true, null, 'Push subscription removed');

} else {
    jsonResponse(false, null, 'Method not allowed', 405);
}
