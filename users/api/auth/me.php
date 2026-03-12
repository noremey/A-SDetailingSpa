<?php
/**
 * Get Current User Profile
 * GET: requires Bearer token
 */
require_once __DIR__ . '/../staff-config.php';

$authUser = requireAuth();
$db = getDB();

$stmt = $db->prepare("
    SELECT id, user_code, name, phone, email, role, avatar, status, last_login, created_at
    FROM users WHERE id = ? AND status = 'active'
");
$stmt->execute([$authUser['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    apiResponse(false, null, 'User not found', 404);
}

$user['id'] = (int)$user['id'];

apiResponse(true, ['user' => $user]);
