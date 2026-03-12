<?php
/**
 * ANSSPA - Application Configuration
 * JWT Auth, CORS, Helpers, Settings
 */

// Suppress PHP warnings/notices from corrupting JSON API responses
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/secrets.php';

define('APP_NAME', 'ANSSPA');
define('APP_VERSION', '1.0.0');
define('UPLOAD_DIR', __DIR__ . '/../../uploads/');

date_default_timezone_set('Asia/Kuala_Lumpur');

// ============================================
// CORS Headers
// ============================================
function setCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    // Auto-detect: allow same-host origins + localhost/LAN for dev
    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
    $allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost',
        'http://127.0.0.1',
        'https://' . $currentHost,
        'http://' . $currentHost,
    ];

    if (in_array($origin, $allowed)
        || strpos($origin, 'localhost') !== false
        || strpos($origin, '192.168.') !== false
        || strpos($origin, $currentHost) !== false
    ) {
        header("Access-Control-Allow-Origin: $origin");
    } elseif (empty($origin)) {
        // Same-origin requests (no Origin header) — allow
        header("Access-Control-Allow-Origin: *");
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

setCorsHeaders();

// ============================================
// JWT Helpers (No library needed)
// ============================================
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

function jwtEncode($payload) {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $payloadEncoded = base64url_encode(json_encode($payload));
    $signature = base64url_encode(
        hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true)
    );
    return "$header.$payloadEncoded.$signature";
}

function jwtDecode($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;
    $validSig = base64url_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );

    if (!hash_equals($validSig, $signature)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!$data || ($data['exp'] ?? 0) < time()) return null;

    return $data;
}

// ============================================
// Auth Helpers
// ============================================
function getAuthUser() {
    // Try multiple ways to get the Authorization header (Apache on Windows quirks)
    $authHeader = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
        return jwtDecode(trim($matches[1]));
    }
    return null;
}

function requireAuth() {
    $user = getAuthUser();
    if (!$user) {
        apiResponse(false, null, 'Unauthorized. Please login.', 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if (!in_array($user['role'], ['admin', 'staff', 'super_admin'])) {
        apiResponse(false, null, 'Admin access required', 403);
    }
    return $user;
}

// ============================================
// API Response Helper
// ============================================
function apiResponse($success, $data = null, $message = '', $statusCode = 200) {
    http_response_code($statusCode);
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
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

// ============================================
// Input Sanitization
// ============================================
function sanitizeString($input) {
    if ($input === null) return '';
    // Just trim — SQL injection handled by PDO prepared statements,
    // XSS handled by React's default escaping on the frontend.
    // Do NOT use htmlspecialchars() here — it double-encodes & < > etc.
    return trim((string)$input);
}

function sanitizeInt($input) {
    return (int)filter_var($input, FILTER_SANITIZE_NUMBER_INT);
}

function sanitizeFloat($input) {
    return (float)filter_var($input, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
}

function sanitizeEmail($input) {
    if ($input === null) return '';
    return filter_var(trim((string)$input), FILTER_SANITIZE_EMAIL);
}

function sanitizePhone($input) {
    if ($input === null) return '';
    return preg_replace('/[^0-9+\-\s]/', '', trim((string)$input));
}

// ============================================
// Settings Helpers
// ============================================
function getSetting($key) {
    $db = getDB();
    $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['setting_value'] : null;
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
        $result[$row['setting_key']] = $row['setting_value'];
    }
    return $result;
}

function updateSetting($key, $value) {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    $stmt->execute([$key, $value]);
    return $stmt->rowCount() > 0;
}

// ============================================
// Currency Helper (cached)
// ============================================
function currency() {
    static $symbol = null;
    if ($symbol === null) {
        $symbol = getSetting('currency_symbol') ?: 'RM';
    }
    return $symbol;
}

// ============================================
// User Code Generator
// ============================================
function generateUserCode() {
    $db = getDB();
    // Note: This may be called inside an existing transaction, so don't start a new one.
    // Use a simple atomic update + select approach.
    $stmt = $db->prepare("UPDATE user_code_sequence SET last_number = last_number + 1");
    $stmt->execute();
    $stmt = $db->query("SELECT last_number FROM user_code_sequence LIMIT 1");
    $num = $stmt->fetchColumn();
    return 'LC-' . str_pad($num, 4, '0', STR_PAD_LEFT);
}

// ============================================
// Activity Logger
// ============================================
function logActivity($userId, $action, $targetType = null, $targetId = null, $description = null, $metadata = null) {
    try {
        $db = getDB();
        $stmt = $db->prepare("
            INSERT INTO activity_log (user_id, action, target_type, target_id, description, metadata, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $action,
            $targetType,
            $targetId,
            $description,
            $metadata ? json_encode($metadata) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
        ]);
    } catch (Exception $e) {
        // Silently fail - logging should never break the app
    }
}

// ============================================
// Request Input Helper
// ============================================
function getInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function getAction() {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        return sanitizeString($_GET['action'] ?? 'list');
    }
    $input = getInput();
    return sanitizeString($input['action'] ?? '');
}

// ============================================
// Google Token Verification
// ============================================
function verifyGoogleToken($idToken) {
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $payload = json_decode($response, true);
    if (!$payload) return null;

    // Verify audience matches our client ID
    if (($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
        return null;
    }

    // Verify token not expired
    if (($payload['exp'] ?? 0) < time()) {
        return null;
    }

    return [
        'google_id' => $payload['sub'] ?? null,
        'email'     => $payload['email'] ?? null,
        'name'      => $payload['name'] ?? $payload['email'] ?? 'Google User',
        'picture'   => $payload['picture'] ?? null,
        'email_verified' => ($payload['email_verified'] ?? 'false') === 'true',
    ];
}

// ============================================
// Plate Number Sanitizer
// ============================================
function sanitizePlateNumber($input) {
    if ($input === null) return '';
    // Remove special chars, keep alphanumeric and spaces
    $plate = preg_replace('/[^A-Za-z0-9\s]/', '', trim((string)$input));
    return strtoupper($plate);
}

// ============================================
// Check if email is super admin
// ============================================
function isSuperAdminEmail($email) {
    $superEmails = array_map('trim', explode(',', SUPER_ADMIN_EMAILS));
    return in_array(strtolower($email), array_map('strtolower', $superEmails));
}
