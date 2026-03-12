<?php
/**
 * Phone Login (check only)
 * POST: { phone }
 * - If exists: login + return user
 * - If new: return is_new = true (don't create yet, registration needed)
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$phone = sanitizePhone($input['phone'] ?? '');

if (empty($phone) || strlen($phone) < 9) {
    jsonResponse(false, null, 'Sila masukkan nombor telefon yang sah');
}

$db = getDB();

// Look up existing customer
$stmt = $db->prepare("SELECT id, user_code, name, phone, email, avatar, status FROM users WHERE phone = ? AND role = 'customer'");
$stmt->execute([$phone]);
$user = $stmt->fetch();

if ($user) {
    if ($user['status'] !== 'active') {
        jsonResponse(false, null, 'Akaun anda tidak aktif. Sila hubungi admin.');
    }
    $_SESSION['user_id'] = (int)$user['id'];

    $stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    jsonResponse(true, [
        'user' => [
            'id'        => (int)$user['id'],
            'user_code' => $user['user_code'],
            'name'      => $user['name'],
            'phone'     => $user['phone'],
            'email'     => $user['email'],
            'is_new'    => false,
        ]
    ], 'Berjaya log masuk');
}

// Phone not found - tell frontend to show registration
jsonResponse(true, [
    'is_new'  => true,
    'phone'   => $phone
], 'Nombor baru. Sila daftar akaun.');
