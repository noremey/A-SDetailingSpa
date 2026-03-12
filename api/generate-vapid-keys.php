<?php
/**
 * Generate VAPID Keys for Push Notifications
 * Admin only
 */
require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/helpers/web-push.php';

$user = requireAdmin();

try {
    $keys = generateVapidKeys();

    $pdo = getDB();

    // Save public key
    $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('vapid_public_key', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->execute([$keys['publicKey']]);

    // Save private key
    $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('vapid_private_key', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->execute([$keys['privateKey']]);

    apiResponse(true, ['public_key' => $keys['publicKey']], 'VAPID keys generated successfully');

} catch (Exception $e) {
    apiResponse(false, null, 'Failed to generate VAPID keys: ' . $e->getMessage(), 500);
}
