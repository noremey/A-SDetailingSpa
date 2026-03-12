<?php
/**
 * New Customer Registration
 * POST: { phone, name, email, plate_number, vehicle_type, vehicle_model }
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$phone       = sanitizePhone($input['phone'] ?? '');
$name        = sanitizeString($input['name'] ?? '');
$email       = filter_var(trim($input['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$plateNumber = sanitizePlateNumber($input['plate_number'] ?? '');
$vehicleType = sanitizeString($input['vehicle_type'] ?? 'car');
$vehicleModel = sanitizeString($input['vehicle_model'] ?? '');

// Validation
if (empty($phone) || strlen($phone) < 9) {
    jsonResponse(false, null, 'Nombor telefon tidak sah');
}
if (empty($name) || strlen($name) < 2) {
    jsonResponse(false, null, 'Nama diperlukan (minimum 2 aksara)');
}

$db = getDB();

// Check require_vehicle setting
$rvStmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'require_vehicle'");
$rvStmt->execute();
$requireVehicle = ($rvStmt->fetchColumn() ?? '1') === '1';

if ($requireVehicle) {
    if (empty($plateNumber) || strlen($plateNumber) < 2) {
        jsonResponse(false, null, 'Nombor plat kenderaan diperlukan');
    }
}

// Check phone not already taken (any role - phone is UNIQUE)
$stmt = $db->prepare("SELECT id, role FROM users WHERE phone = ?");
$stmt->execute([$phone]);
$existing = $stmt->fetch();
if ($existing) {
    jsonResponse(false, null, 'Nombor telefon ini sudah didaftarkan');
}

// Check plate not already taken by another user (only if vehicle required and plate provided)
if ($requireVehicle && !empty($plateNumber)) {
    $stmt = $db->prepare("
        SELECT v.id FROM vehicles v
        JOIN users u ON v.user_id = u.id
        WHERE v.plate_number = ? AND v.status = 'active' AND u.role = 'customer'
    ");
    $stmt->execute([$plateNumber]);
    if ($stmt->fetch()) {
        jsonResponse(false, null, 'Nombor plat ini sudah didaftarkan oleh pengguna lain');
    }
}

$db->beginTransaction();
try {
    $userCode = generateUserCode();

    // Create user
    $stmt = $db->prepare("
        INSERT INTO users (user_code, name, phone, email, password, role, status, last_login, created_at)
        VALUES (?, ?, ?, ?, ?, 'customer', 'active', NOW(), NOW())
    ");
    $stmt->execute([$userCode, $name, $phone, $email ?: null, password_hash($phone, PASSWORD_DEFAULT)]);
    $userId = (int)$db->lastInsertId();

    // Create vehicle (only if vehicle is required and plate provided)
    if ($requireVehicle && !empty($plateNumber)) {
        $stmt = $db->prepare("
            INSERT INTO vehicles (user_id, plate_number, vehicle_type, vehicle_model, is_primary, status)
            VALUES (?, ?, ?, ?, 1, 'active')
        ");
        $stmt->execute([$userId, $plateNumber, $vehicleType, $vehicleModel ?: null]);
    }

    // Create first loyalty card
    $tokensRequired = 10;
    $settingStmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'tokens_per_card'");
    $settingStmt->execute();
    $tpc = $settingStmt->fetchColumn();
    if ($tpc) $tokensRequired = (int)$tpc;

    $stmt = $db->prepare("
        INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status, created_at)
        VALUES (?, 1, ?, 0, 'active', NOW())
    ");
    $stmt->execute([$userId, $tokensRequired]);

    $db->commit();

    $_SESSION['user_id'] = $userId;

    jsonResponse(true, [
        'user' => [
            'id'        => $userId,
            'user_code' => $userCode,
            'name'      => $name,
            'phone'     => $phone,
            'email'     => $email ?: null,
            'is_new'    => false,
        ]
    ], 'Pendaftaran berjaya! Selamat datang.');

} catch (Exception $e) {
    $db->rollBack();
    $errorMsg = 'Ralat semasa mendaftar. Sila cuba lagi.';
    // Include actual error in development for debugging
    if ($isLocalhost) {
        $errorMsg .= ' [DEBUG: ' . $e->getMessage() . ']';
    }
    jsonResponse(false, null, $errorMsg);
}
