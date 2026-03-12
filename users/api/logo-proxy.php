<?php
/**
 * Logo Proxy - Serves business logo from shared uploads
 * Reads logo path from local DB, serves from main app's uploads folder
 */
require_once __DIR__ . '/config.php';

$cacheDir  = __DIR__ . '/../cache';
$trackFile = $cacheDir . '/logo_name.txt';

// Read logo path from local DB
$settings = getSettings(['business_logo']);
$logoPath = $settings['business_logo'] ?? '';

if (empty($logoPath)) {
    // No logo set - serve cached if available
    $cached = glob($cacheDir . '/logo_cached.*');
    if ($cached) {
        $mime = mime_content_type($cached[0]) ?: 'image/png';
        header('Content-Type: ' . $mime);
        readfile($cached[0]);
    } else {
        http_response_code(404);
    }
    exit;
}

// Get the filename from the path
$currentName = basename($logoPath);
$ext = pathinfo($currentName, PATHINFO_EXTENSION) ?: 'png';
$cacheFile = $cacheDir . '/logo_cached.' . $ext;

// Check if logo has changed or cache doesn't exist
$cachedName = file_exists($trackFile) ? trim(file_get_contents($trackFile)) : '';
$needsFetch = ($cachedName !== $currentName) || !file_exists($cacheFile);

if (!$needsFetch) {
    // Serve from cache
    $mime = mime_content_type($cacheFile) ?: 'image/png';
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=60');
    readfile($cacheFile);
    exit;
}

// Try local file first (main app's uploads folder)
$localFile = realpath(__DIR__ . '/../../uploads/' . $currentName);
if ($localFile && file_exists($localFile)) {
    $imageData = file_get_contents($localFile);
} else {
    // Fallback: fetch from remote
    $logoUrl = (strpos($logoPath, 'http') === 0) ? $logoPath : LIVE_BASE . '/uploads/' . $currentName;
    $imageData = fetchUrl($logoUrl);
}

if (!$imageData) {
    http_response_code(404);
    exit;
}

// Clear old cache files and save new
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}
foreach (glob($cacheDir . '/logo_cached.*') as $old) {
    unlink($old);
}
file_put_contents($cacheFile, $imageData);
file_put_contents($trackFile, $currentName);

// Serve
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->buffer($imageData) ?: 'image/png';
header('Content-Type: ' . $mime);
header('Cache-Control: public, max-age=60');
echo $imageData;
