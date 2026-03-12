<?php
/**
 * Login - for both Admin and Customer
 * POST: { identifier (phone/email), password? }
 * Customers login with phone only (no password)
 * Admin/Staff login with identifier + password
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$identifier = sanitizeString($input['identifier'] ?? '');
$password   = $input['password'] ?? '';

if (empty($identifier)) {
    apiResponse(false, null, 'Phone number is required');
}

$db = getDB();

// Find by phone, email, or user_code
$stmt = $db->prepare("
    SELECT id, user_code, name, phone, email, password, role, status, avatar, google_id
    FROM users
    WHERE (phone = ? OR email = ? OR user_code = ?) AND status = 'active'
    LIMIT 1
");
$stmt->execute([$identifier, $identifier, $identifier]);
$user = $stmt->fetch();

if (!$user) {
    apiResponse(false, null, 'Invalid credentials', 401);
}

// Admin/Staff requires password, Customer does not
if ($user['role'] !== 'customer') {
    if (empty($password) || !password_verify($password, $user['password'])) {
        apiResponse(false, null, 'Invalid credentials', 401);
    }
}

// Update last_login
$stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
$stmt->execute([$user['id']]);

logActivity($user['id'], 'login', 'user', $user['id'], $user['name'] . ' logged in');

$token = jwtEncode([
    'user_id'   => (int)$user['id'],
    'user_code' => $user['user_code'],
    'role'      => $user['role'],
    'name'      => $user['name']
]);

// Check profile completion for customers
$needsProfileCompletion = false;
$needsPhone = false;
$needsVehicle = false;
if ($user['role'] === 'customer') {
    $needsPhone = empty($user['phone']);
    $stmtV = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
    $stmtV->execute([$user['id']]);
    $needsVehicle = (int)$stmtV->fetchColumn() === 0;
    $needsProfileCompletion = $needsPhone || $needsVehicle;
}

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
        'google_id' => $user['google_id'] ?? null
    ],
    'needs_profile_completion' => $needsProfileCompletion,
    'needs_phone'    => $needsPhone,
    'needs_vehicle'  => $needsVehicle,
], 'Login successful');
