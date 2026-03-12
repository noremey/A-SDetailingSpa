<?php
/**
 * Profile Management
 * GET: Get user profile + vehicles
 * POST: Update profile
 */
require_once __DIR__ . '/config.php';

$userId = requireLogin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // User info
    $stmt = $db->prepare("SELECT id, user_code, name, phone, email, avatar, created_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    $user['id'] = (int)$user['id'];

    // Vehicles
    $stmt = $db->prepare("
        SELECT id, plate_number, vehicle_type, vehicle_model, is_primary, created_at
        FROM vehicles
        WHERE user_id = ? AND status = 'active'
        ORDER BY is_primary DESC, created_at ASC
    ");
    $stmt->execute([$userId]);
    $vehicles = $stmt->fetchAll();
    foreach ($vehicles as &$v) {
        $v['id'] = (int)$v['id'];
        $v['is_primary'] = (bool)$v['is_primary'];
    }

    jsonResponse(true, ['user' => $user, 'vehicles' => $vehicles]);

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $name  = sanitizeString($input['name'] ?? '');
    $email = filter_var(trim($input['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $phone = sanitizePhone($input['phone'] ?? '');

    if (empty($name)) {
        jsonResponse(false, null, 'Nama diperlukan');
    }

    // Check phone uniqueness
    if (!empty($phone)) {
        $stmt = $db->prepare("SELECT id FROM users WHERE phone = ? AND id != ? AND role = 'customer'");
        $stmt->execute([$phone, $userId]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Nombor telefon telah digunakan');
        }
    }

    $stmt = $db->prepare("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?");
    $stmt->execute([$name, $email ?: null, $phone, $userId]);

    jsonResponse(true, null, 'Profil berjaya dikemaskini');
} else {
    jsonResponse(false, null, 'Method not allowed', 405);
}
