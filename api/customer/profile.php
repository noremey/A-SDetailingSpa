<?php
/**
 * Customer Profile
 * GET: Get profile
 * PUT: Update profile
 */
require_once __DIR__ . '/../config/app.php';

$authUser = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT id, user_code, name, phone, email, avatar, created_at
        FROM users WHERE id = ?
    ");
    $stmt->execute([$authUser['user_id']]);
    $user = $stmt->fetch();
    $user['id'] = (int)$user['id'];

    apiResponse(true, ['user' => $user]);

} elseif ($method === 'PUT') {
    $input = getInput();
    $name  = sanitizeString($input['name'] ?? '');
    $email = sanitizeEmail($input['email'] ?? '');
    $phone = sanitizePhone($input['phone'] ?? '');

    if (empty($name)) {
        apiResponse(false, null, 'Name is required');
    }

    // Check phone uniqueness (if changed)
    if (!empty($phone)) {
        $stmt = $db->prepare("SELECT id FROM users WHERE phone = ? AND id != ? AND role = 'customer'");
        $stmt->execute([$phone, $authUser['user_id']]);
        if ($stmt->fetch()) {
            apiResponse(false, null, 'Phone number already in use');
        }
    }

    $stmt = $db->prepare("
        UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?
    ");
    $stmt->execute([$name, $email ?: null, $phone, $authUser['user_id']]);

    // Handle password change
    if (!empty($input['new_password'])) {
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'];

        if (strlen($newPassword) < 6) {
            apiResponse(false, null, 'New password must be at least 6 characters');
        }

        // Verify current password
        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$authUser['user_id']]);
        $user = $stmt->fetch();

        if (!password_verify($currentPassword, $user['password'])) {
            apiResponse(false, null, 'Current password is incorrect');
        }

        $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $authUser['user_id']]);
    }

    logActivity($authUser['user_id'], 'profile_updated', 'user', $authUser['user_id'], 'Profile updated');

    apiResponse(true, null, 'Profile updated successfully');
}
