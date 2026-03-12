<?php
/**
 * Get Current User Profile
 * GET: requires Bearer token
 */
require_once __DIR__ . '/../config/app.php';

$authUser = requireAuth();
$db = getDB();

$stmt = $db->prepare("
    SELECT id, user_code, name, phone, email, role, avatar, status, last_login, created_at, google_id
    FROM users WHERE id = ? AND status = 'active'
");
$stmt->execute([$authUser['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    apiResponse(false, null, 'User not found', 404);
}

$user['id'] = (int)$user['id'];

// If customer, include active card info + profile completion check
if ($user['role'] === 'customer') {
    $stmt = $db->prepare("
        SELECT id, card_number, tokens_required, tokens_earned, status, created_at
        FROM loyalty_cards
        WHERE user_id = ? AND status = 'active'
        LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $card = $stmt->fetch();
    if ($card) {
        $card['id'] = (int)$card['id'];
        $card['tokens_required'] = (int)$card['tokens_required'];
        $card['tokens_earned'] = (int)$card['tokens_earned'];
    }
    $user['active_card'] = $card;

    // Total completed cards
    $stmt = $db->prepare("SELECT COUNT(*) FROM loyalty_cards WHERE user_id = ? AND status IN ('completed','redeemed')");
    $stmt->execute([$user['id']]);
    $user['total_completed_cards'] = (int)$stmt->fetchColumn();

    // Profile completion check: customer must have phone AND at least one vehicle
    $hasPhone = !empty($user['phone']);
    $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$user['id']]);
    $hasVehicle = (int)$stmt->fetchColumn() > 0;
    $user['needs_profile_completion'] = !$hasPhone || !$hasVehicle;
    $user['needs_phone'] = !$hasPhone;
    $user['needs_vehicle'] = !$hasVehicle;
}

apiResponse(true, ['user' => $user]);
