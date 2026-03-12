<?php
/**
 * Public Settings - No auth required
 * Returns business branding settings for the login/register pages
 * Security: Only allows AJAX/fetch requests, blocks direct browser access
 */
require_once __DIR__ . '/config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    apiResponse(false, null, 'Method not allowed', 405);
}

// ── Security: Block direct browser access ──
// Only allow requests from the app (AJAX/fetch), not direct URL visits
$isAjax = (
    (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
    || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
    || (isset($_SERVER['HTTP_SEC_FETCH_MODE']) && $_SERVER['HTTP_SEC_FETCH_MODE'] === 'cors')
    || (isset($_SERVER['HTTP_ORIGIN']))
);

if (!$isAjax) {
    http_response_code(403);
    die(json_encode([
        'success' => false,
        'message' => 'Direct access not allowed. This API is for application use only.'
    ]));
}

$settings = getSettings();

// Only expose public/branding settings, not sensitive ones
$publicKeys = [
    'business_name', 'business_logo', 'business_phone', 'business_email',
    'business_address', 'business_type', 'tokens_per_card', 'reward_description',
    'primary_color', 'secondary_color', 'currency_symbol', 'currency_code',
    'timezone', 'language', 'min_spend', 'min_spend_enabled', 'payment_tracking_enabled',
    'require_vehicle', 'staff_visible_menus', 'admin_visible_menus', 'super_admin_visible_menus',
    'vapid_public_key', 'push_notifications_enabled',
    'pos_quick_quantities', 'pos_quantity_picker'
];

$publicSettings = [];
foreach ($publicKeys as $key) {
    $publicSettings[$key] = $settings[$key] ?? '';
}

apiResponse(true, ['settings' => $publicSettings]);
