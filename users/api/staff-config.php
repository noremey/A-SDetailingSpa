<?php
/**
 * Staff POS API - Configuration
 * Extends base config with JWT auth, CORS, and staff helpers
 * Used by staff-facing endpoints (auth, POS, admin)
 */

require_once __DIR__ . '/config.php';

define('JWT_SECRET', 'ansspa_jwt_secret_key_2026');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// ============================================
// CORS Headers
// ============================================
function setCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    // Auto-detect: allow same-host origins + localhost/LAN for dev
    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
    $allowed = [
        'http://localhost:8081',
        'http://localhost:19006',
        'http://localhost:5173',
        'http://localhost',
        'http://127.0.0.1',
        'https://' . $currentHost,
        'http://' . $currentHost,
    ];

    if (in_array($origin, $allowed)
        || strpos($origin, 'localhost') !== false
        || strpos($origin, '192.168.') !== false
        || strpos($origin, '10.') !== false
        || strpos($origin, $currentHost) !== false
    ) {
        header("Access-Control-Allow-Origin: $origin");
    } elseif (empty($origin)) {
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
// JWT Helpers
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
// API Response (overrides jsonResponse for staff endpoints)
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
// Input & Sanitization Helpers
// ============================================
function getInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function sanitizeInt($input) {
    return (int)filter_var($input, FILTER_SANITIZE_NUMBER_INT);
}

function sanitizeFloat($input) {
    return (float)filter_var($input, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
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
