<?php
/**
 * Dynamic Web App Manifest
 * Reads business name + logo from shared database for iOS/Android home screen
 */
header('Content-Type: application/manifest+json; charset=utf-8');

require_once __DIR__ . '/api/config.php';

$name = 'Loyalty Rewards';
$themeColor = '#3b82f6';
$bgColor = '#f1f5f9';

try {
    $settings = getSettings(['business_name', 'primary_color']);
    $name = $settings['business_name'] ?? $name;
    $themeColor = $settings['primary_color'] ?? $themeColor;
} catch (Exception $e) {
    // Use defaults if DB unavailable
}

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']);
$iconUrl = $baseUrl . '/api/logo-proxy.php';

$manifest = [
    'name' => $name,
    'short_name' => $name,
    'start_url' => $baseUrl . '/',
    'scope' => $baseUrl . '/',
    'display' => 'standalone',
    'orientation' => 'portrait',
    'theme_color' => $themeColor,
    'background_color' => $bgColor,
    'icons' => [
        ['src' => $iconUrl, 'sizes' => '192x192', 'type' => 'image/png'],
        ['src' => $iconUrl, 'sizes' => '512x512', 'type' => 'image/png'],
        ['src' => $iconUrl, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
    ]
];

echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
