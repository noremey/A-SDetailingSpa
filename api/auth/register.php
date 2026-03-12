<?php
/**
 * Customer Registration
 * POST: { name, phone, plate_number, email?, vehicle_type? }
 * Customers login via phone number only (no password)
 * plate_number is REQUIRED for car wash system
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$name        = sanitizeString($input['name'] ?? '');
$phone       = sanitizePhone($input['phone'] ?? '');
$email       = sanitizeEmail($input['email'] ?? '');
$plateNumber = sanitizePlateNumber($input['plate_number'] ?? '');
$vehicleType = sanitizeString($input['vehicle_type'] ?? 'car');

// Validation
if (empty($name)) apiResponse(false, null, 'Name is required');
if (empty($phone)) apiResponse(false, null, 'Phone number is required');
if (strlen($phone) < 10) apiResponse(false, null, 'Please enter a valid phone number');
if (empty($plateNumber) || strlen($plateNumber) < 2) {
    apiResponse(false, null, 'Vehicle plate number is required');
}

$db = getDB();

// Check duplicate phone
$stmt = $db->prepare("SELECT id FROM users WHERE phone = ? AND role = 'customer'");
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    apiResponse(false, null, 'Phone number already registered');
}

$db->beginTransaction();
try {
    $userCode = generateUserCode();

    $stmt = $db->prepare("
        INSERT INTO users (user_code, name, phone, email, password, role, status)
        VALUES (?, ?, ?, ?, NULL, 'customer', 'active')
    ");
    $stmt->execute([$userCode, $name, $phone, $email ?: null]);
    $userId = (int)$db->lastInsertId();

    // Create first loyalty card
    $tokensPerCard = (int)(getSetting('tokens_per_card') ?: 10);
    $stmt = $db->prepare("
        INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status)
        VALUES (?, 1, ?, 0, 'active')
    ");
    $stmt->execute([$userId, $tokensPerCard]);

    // Register first vehicle (primary)
    $stmt = $db->prepare("
        INSERT INTO vehicles (user_id, plate_number, vehicle_type, is_primary)
        VALUES (?, ?, ?, 1)
    ");
    $stmt->execute([$userId, $plateNumber, $vehicleType]);

    logActivity($userId, 'customer_registered', 'user', $userId, "Customer $name registered with vehicle $plateNumber");

    $db->commit();

    // Generate JWT
    $token = jwtEncode([
        'user_id'   => $userId,
        'user_code' => $userCode,
        'role'      => 'customer',
        'name'      => $name
    ]);

    apiResponse(true, [
        'token' => $token,
        'user'  => [
            'id'        => $userId,
            'user_code' => $userCode,
            'name'      => $name,
            'phone'     => $phone,
            'email'     => $email,
            'role'      => 'customer'
        ]
    ], 'Registration successful! Welcome!');

} catch (Exception $e) {
    $db->rollBack();
    apiResponse(false, null, 'Registration failed. Please try again.', 500);
}
