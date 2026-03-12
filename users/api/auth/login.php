<?php
/**
 * Staff Login
 * POST: { identifier (phone/email), password }
 * Returns JWT token for staff/admin users
 */
require_once __DIR__ . '/../staff-config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$identifier = sanitizeString($input['identifier'] ?? '');
$password   = $input['password'] ?? '';

if (empty($identifier) || empty($password)) {
    apiResponse(false, null, 'Phone/email and password are required');
}

$db = getDB();

// Find by phone, email, or user_code
$stmt = $db->prepare("
    SELECT id, user_code, name, phone, email, password, role, status, avatar
    FROM users
    WHERE (phone = ? OR email = ? OR user_code = ?) AND status = 'active'
    LIMIT 1
");
$stmt->execute([$identifier, $identifier, $identifier]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    apiResponse(false, null, 'Invalid credentials', 401);
}

// Only allow staff/admin roles
if (!in_array($user['role'], ['admin', 'staff', 'super_admin'])) {
    apiResponse(false, null, 'Staff access only', 403);
}

// Update last_login
$stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
$stmt->execute([$user['id']]);

logActivity($user['id'], 'login', 'user', $user['id'], $user['name'] . ' logged in (POS)');

$token = jwtEncode([
    'user_id'   => (int)$user['id'],
    'user_code' => $user['user_code'],
    'role'      => $user['role'],
    'name'      => $user['name']
]);

apiResponse(true, [
    'token' => $token,
    'user'  => [
        'id'        => (int)$user['id'],
        'user_code' => $user['user_code'],
        'name'      => $user['name'],
        'phone'     => $user['phone'],
        'email'     => $user['email'],
        'role'      => $user['role'],
        'avatar'    => $user['avatar'],
    ],
], 'Login successful');
