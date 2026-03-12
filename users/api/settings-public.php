<?php
/**
 * Public Settings - No auth required
 * Reads directly from shared database (ss_apps)
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

// Read settings directly from local DB (same database as main app)
$allSettings = getSettings();

$publicKeys = [
    'business_name', 'business_logo', 'business_phone', 'business_email',
    'business_address', 'business_type', 'tokens_per_card', 'reward_description',
    'primary_color', 'secondary_color', 'currency_symbol', 'currency_code',
    'timezone', 'language', 'min_spend', 'min_spend_enabled', 'payment_tracking_enabled',
    'require_vehicle',
    'vapid_public_key', 'push_notifications_enabled'
];

$publicSettings = [];
foreach ($publicKeys as $key) {
    $publicSettings[$key] = $allSettings[$key] ?? '';
}

// Use local logo proxy for the logo
if (!empty($publicSettings['business_logo'])) {
    $publicSettings['business_logo'] = getLogoProxyUrl();
}

jsonResponse(true, ['settings' => $publicSettings]);
