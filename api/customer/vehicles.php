<?php
/**
 * Customer Vehicle Management (Car Wash)
 * GET action=list: Get user's active vehicles
 * POST action=add: Add a new vehicle
 * POST action=remove: Soft-delete a vehicle
 * POST action=set_primary: Set a vehicle as primary
 */
require_once __DIR__ . '/../config/app.php';

$authUser = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Allow admin to manage customer vehicles via user_id param
if (isset($_GET['user_id']) && in_array($authUser['role'], ['admin', 'staff', 'super_admin'])) {
    $userId = sanitizeInt($_GET['user_id']);
} elseif (isset($_POST['user_id']) || isset(getInput()['user_id'])) {
    $input = getInput();
    if (in_array($authUser['role'], ['admin', 'staff', 'super_admin'])) {
        $userId = sanitizeInt($input['user_id'] ?? 0);
    } else {
        $userId = $authUser['user_id'];
    }
} else {
    $userId = $authUser['user_id'];
}

if ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'list');

    if ($action === 'list') {
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

        apiResponse(true, ['vehicles' => $vehicles]);
    }

} elseif ($method === 'POST') {
    $input = getInput();
    $action = sanitizeString($input['action'] ?? 'add');

    if ($action === 'add') {
        $plateNumber = sanitizePlateNumber($input['plate_number'] ?? '');
        $vehicleType = sanitizeString($input['vehicle_type'] ?? 'car');
        $vehicleModel = sanitizeString($input['vehicle_model'] ?? '');

        if (empty($plateNumber) || strlen($plateNumber) < 2) {
            apiResponse(false, null, 'Plate number is required');
        }

        // Check if plate already exists for this user
        $stmt = $db->prepare("
            SELECT id, status FROM vehicles
            WHERE user_id = ? AND plate_number = ?
        ");
        $stmt->execute([$userId, $plateNumber]);
        $existing = $stmt->fetch();

        if ($existing) {
            if ($existing['status'] === 'active') {
                apiResponse(false, null, 'This plate number is already registered');
            }
            // Reactivate removed vehicle
            $stmt = $db->prepare("UPDATE vehicles SET status = 'active', vehicle_type = ?, vehicle_model = ? WHERE id = ?");
            $stmt->execute([$vehicleType, $vehicleModel ?: null, $existing['id']]);
            $vehicleId = (int)$existing['id'];
        } else {
            // Check if user has any active vehicles (for is_primary)
            $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
            $stmt->execute([$userId]);
            $hasVehicles = (int)$stmt->fetchColumn() > 0;

            $stmt = $db->prepare("
                INSERT INTO vehicles (user_id, plate_number, vehicle_type, vehicle_model, is_primary)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $plateNumber,
                $vehicleType,
                $vehicleModel ?: null,
                $hasVehicles ? 0 : 1  // First vehicle is primary
            ]);
            $vehicleId = (int)$db->lastInsertId();
        }

        logActivity($userId, 'vehicle_added', 'vehicle', $vehicleId,
            "Vehicle $plateNumber registered",
            ['plate_number' => $plateNumber, 'vehicle_type' => $vehicleType]
        );

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

        apiResponse(true, ['vehicles' => $vehicles, 'vehicle_id' => $vehicleId], 'Vehicle added successfully');

    } elseif ($action === 'remove') {
        $vehicleId = sanitizeInt($input['vehicle_id'] ?? 0);
        if ($vehicleId <= 0) {
            apiResponse(false, null, 'Vehicle ID is required');
        }

        // Verify ownership
        $stmt = $db->prepare("SELECT id, plate_number, is_primary FROM vehicles WHERE id = ? AND user_id = ? AND status = 'active'");
        $stmt->execute([$vehicleId, $userId]);
        $vehicle = $stmt->fetch();

        if (!$vehicle) {
            apiResponse(false, null, 'Vehicle not found', 404);
        }

        // Check if it's the only vehicle for a customer
        $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$userId]);
        $vehicleCount = (int)$stmt->fetchColumn();

        // Check user role - customers must have at least 1 vehicle
        $stmt2 = $db->prepare("SELECT role FROM users WHERE id = ?");
        $stmt2->execute([$userId]);
        $userRole = $stmt2->fetchColumn();

        if ($userRole === 'customer' && $vehicleCount <= 1) {
            apiResponse(false, null, 'Cannot remove last vehicle. You must have at least one vehicle registered.');
        }

        // Soft delete
        $stmt = $db->prepare("UPDATE vehicles SET status = 'removed' WHERE id = ?");
        $stmt->execute([$vehicleId]);

        // If was primary, promote next vehicle
        if ($vehicle['is_primary']) {
            $stmt = $db->prepare("
                UPDATE vehicles SET is_primary = 1
                WHERE user_id = ? AND status = 'active'
                ORDER BY created_at ASC
                LIMIT 1
            ");
            $stmt->execute([$userId]);
        }

        logActivity($userId, 'vehicle_removed', 'vehicle', $vehicleId,
            "Vehicle {$vehicle['plate_number']} removed"
        );

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

        apiResponse(true, ['vehicles' => $vehicles], 'Vehicle removed');

    } elseif ($action === 'set_primary') {
        $vehicleId = sanitizeInt($input['vehicle_id'] ?? 0);
        if ($vehicleId <= 0) {
            apiResponse(false, null, 'Vehicle ID is required');
        }

        // Verify ownership
        $stmt = $db->prepare("SELECT id FROM vehicles WHERE id = ? AND user_id = ? AND status = 'active'");
        $stmt->execute([$vehicleId, $userId]);
        if (!$stmt->fetch()) {
            apiResponse(false, null, 'Vehicle not found', 404);
        }

        // Reset all, then set new primary
        $stmt = $db->prepare("UPDATE vehicles SET is_primary = 0 WHERE user_id = ?");
        $stmt->execute([$userId]);
        $stmt = $db->prepare("UPDATE vehicles SET is_primary = 1 WHERE id = ?");
        $stmt->execute([$vehicleId]);

        apiResponse(true, null, 'Primary vehicle updated');
    }
}
