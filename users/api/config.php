<?php
/**
 * ANSSPA Rewards User App - Configuration
 * Connects to the ansspa database
 */

session_start();

date_default_timezone_set('Asia/Kuala_Lumpur');

// Database config - same as main ansspa app
$httpHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
$hostOnly = explode(':', $httpHost)[0];
$isLocalhost = in_array($hostOnly, ['localhost', '127.0.0.1'])
               || strpos($hostOnly, '192.168.') === 0
               || strpos($hostOnly, '10.') === 0
               || strpos($hostOnly, '172.') === 0;

if ($isLocalhost) {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'ansspa');
    define('DB_USER', 'root');
    define('DB_PASS', '');
} else {
    // Production (ansspa.eduhubtech.net)
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'eduhubte_ansspa');
    define('DB_USER', 'eduhubte_ansspa');
    define('DB_PASS', 'eduhubte_ansspa123');
}

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function requireLogin() {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(false, null, 'Not logged in', 401);
    }
    return (int)$_SESSION['user_id'];
}

function jsonResponse($success, $data = null, $message = '', $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    $response = ['success' => $success];
    if ($message) $response['message'] = $message;
    if ($data !== null) {
        if (is_array($data)) {
            $response = array_merge($response, $data);
        } else {
            $response['data'] = $data;
        }
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

function sanitizeString($input) {
    if ($input === null) return '';
    return htmlspecialchars(trim((string)$input), ENT_QUOTES, 'UTF-8');
}

function sanitizePhone($input) {
    if ($input === null) return '';
    return preg_replace('/[^0-9+\-]/', '', trim((string)$input));
}

function sanitizePlateNumber($input) {
    if ($input === null) return '';
    $plate = preg_replace('/[^A-Za-z0-9\s]/', '', trim((string)$input));
    return strtoupper($plate);
}

function generateUserCode() {
    $db = getDB();
    $stmt = $db->prepare("UPDATE user_code_sequence SET last_number = last_number + 1");
    $stmt->execute();
    $stmt = $db->query("SELECT last_number FROM user_code_sequence LIMIT 1");
    $num = $stmt->fetchColumn();
    return 'LC-' . str_pad($num, 4, '0', STR_PAD_LEFT);
}

// Live API base — auto-detect from current domain
$_protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$_host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$_basePath = dirname(dirname($_SERVER['SCRIPT_NAME'])); // go up from /users/api/ to /
if ($_basePath === '\\' || $_basePath === '/') $_basePath = '';
define('LIVE_BASE', $_protocol . '://' . $_host . $_basePath);
define('LIVE_API', LIVE_BASE . '/api/settings-public.php');

function fetchUrl($url, $timeout = 10) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT      => 'Mozilla/5.0',
            CURLOPT_HTTPHEADER     => ['Referer: ' . LIVE_BASE],
        ]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($result !== false && $httpCode >= 200 && $httpCode < 400) ? $result : false;
    }
    // Fallback to file_get_contents
    $ctx = stream_context_create(['http' => [
        'header'  => "Referer: " . LIVE_BASE . "\r\nUser-Agent: Mozilla/5.0\r\n",
        'timeout' => $timeout,
    ]]);
    return @file_get_contents($url, false, $ctx);
}

function fetchLiveSettings() {
    $json = fetchUrl(LIVE_API);
    if ($json === false) return null;
    $data = json_decode($json, true);
    if (!$data || !$data['success'] || !isset($data['settings'])) return null;
    return $data;
}

function getLogoProxyUrl() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $baseUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . str_replace('/api', '', dirname($_SERVER['SCRIPT_NAME']));
    return $baseUrl . '/api/logo-proxy.php';
}

function currency() {
    static $symbol = null;
    if ($symbol === null) {
        $db = getDB();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'currency_symbol'");
        $stmt->execute();
        $row = $stmt->fetch();
        $symbol = $row ? $row['setting_value'] : 'RM';
    }
    return $symbol;
}

function getSettings($keys = []) {
    $db = getDB();
    if (empty($keys)) {
        $stmt = $db->query("SELECT setting_key, setting_value FROM settings");
    } else {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($keys);
    }
    $result = [];
    while ($row = $stmt->fetch()) {
        $value = $row['setting_value'];
        if ($value !== null) {
            $value = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
        }
        $result[$row['setting_key']] = $value;
    }
    return $result;
}
