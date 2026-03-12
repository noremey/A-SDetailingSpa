<?php
/**
 * Vehicle Management
 * POST action=add: Add vehicle
 * POST action=remove: Remove vehicle
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = requireLogin();
$db = getDB();
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = sanitizeString($input['action'] ?? 'add');

if ($action === 'add') {
    $plateNumber = sanitizePlateNumber($input['plate_number'] ?? '');
    $vehicleType = sanitizeString($input['vehicle_type'] ?? 'car');
    $vehicleModel = sanitizeString($input['vehicle_model'] ?? '');

    if (empty($plateNumber) || strlen($plateNumber) < 2) {
        jsonResponse(false, null, 'Nombor plat diperlukan');
    }

    // Check duplicate
    $stmt = $db->prepare("SELECT id, status FROM vehicles WHERE user_id = ? AND plate_number = ?");
    $stmt->execute([$userId, $plateNumber]);
    $existing = $stmt->fetch();

    if ($existing) {
        if ($existing['status'] === 'active') {
            jsonResponse(false, null, 'Nombor plat ini sudah didaftarkan');
        }
        // Reactivate
        $stmt = $db->prepare("UPDATE vehicles SET status = 'active', vehicle_type = ?, vehicle_model = ? WHERE id = ?");
        $stmt->execute([$vehicleType, $vehicleModel ?: null, $existing['id']]);
    } else {
        $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$userId]);
        $hasVehicles = (int)$stmt->fetchColumn() > 0;

        $stmt = $db->prepare("
            INSERT INTO vehicles (user_id, plate_number, vehicle_type, vehicle_model, is_primary)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $plateNumber, $vehicleType, $vehicleModel ?: null, $hasVehicles ? 0 : 1]);
    }

    // Return updated list
    $stmt = $db->prepare("
        SELECT id, plate_number, vehicle_type, vehicle_model, is_primary, created_at
        FROM vehicles WHERE user_id = ? AND status = 'active'
        ORDER BY is_primary DESC, created_at ASC
    ");
    $stmt->execute([$userId]);
    $vehicles = $stmt->fetchAll();
    foreach ($vehicles as &$v) {
        $v['id'] = (int)$v['id'];
        $v['is_primary'] = (bool)$v['is_primary'];
    }

    jsonResponse(true, ['vehicles' => $vehicles], 'Kenderaan berjaya ditambah');

} elseif ($action === 'remove') {
    $vehicleId = (int)($input['vehicle_id'] ?? 0);
    if ($vehicleId <= 0) {
        jsonResponse(false, null, 'ID kenderaan diperlukan');
    }

    // Verify ownership
    $stmt = $db->prepare("SELECT id, plate_number, is_primary FROM vehicles WHERE id = ? AND user_id = ? AND status = 'active'");
    $stmt->execute([$vehicleId, $userId]);
    $vehicle = $stmt->fetch();

    if (!$vehicle) {
        jsonResponse(false, null, 'Kenderaan tidak dijumpai', 404);
    }

    // Must have at least 1 vehicle
    $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$userId]);
    if ((int)$stmt->fetchColumn() <= 1) {
        jsonResponse(false, null, 'Anda mesti mempunyai sekurang-kurangnya satu kenderaan');
    }

    // Soft delete
    $stmt = $db->prepare("UPDATE vehicles SET status = 'removed' WHERE id = ?");
    $stmt->execute([$vehicleId]);

    // Promote next vehicle if was primary
    if ($vehicle['is_primary']) {
        $stmt = $db->prepare("
            UPDATE vehicles SET is_primary = 1
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at ASC LIMIT 1
        ");
        $stmt->execute([$userId]);
    }

    // Return updated list
    $stmt = $db->prepare("
        SELECT id, plate_number, vehicle_type, vehicle_model, is_primary, created_at
        FROM vehicles WHERE user_id = ? AND status = 'active'
        ORDER BY is_primary DESC, created_at ASC
    ");
    $stmt->execute([$userId]);
    $vehicles = $stmt->fetchAll();
    foreach ($vehicles as &$v) {
        $v['id'] = (int)$v['id'];
        $v['is_primary'] = (bool)$v['is_primary'];
    }

    jsonResponse(true, ['vehicles' => $vehicles], 'Kenderaan berjaya dibuang');
}
