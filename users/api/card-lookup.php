<?php
/**
 * POS Card Lookup - Find customer by phone number
 * POST: { phone } - Returns customer info + active loyalty card
 * Requires JWT auth (staff/admin)
 */
require_once __DIR__ . '/staff-config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();
$db = getDB();
$input = getInput();

$phone = sanitizeString($input['phone'] ?? '');

if (empty($phone)) {
    apiResponse(false, null, 'Phone number is required');
}

try {
    // Find customer by exact phone match
    $stmt = $db->prepare("
        SELECT id, user_code, name, phone, email, avatar
        FROM users
        WHERE phone = ? AND role = 'customer' AND status = 'active'
        LIMIT 1
    ");
    $stmt->execute([$phone]);
    $customer = $stmt->fetch();

    if (!$customer) {
        apiResponse(false, null, 'No customer found with this phone number');
    }

    // Get active loyalty card
    $stmt = $db->prepare("
        SELECT id, card_number, tokens_earned, tokens_required, status
        FROM loyalty_cards
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$customer['id']]);
    $card = $stmt->fetch();

    // Count completed cards
    $stmt = $db->prepare("
        SELECT COUNT(*) as completed_count
        FROM loyalty_cards
        WHERE user_id = ? AND status IN ('completed', 'redeemed')
    ");
    $stmt->execute([$customer['id']]);
    $completed = $stmt->fetch();

    apiResponse(true, [
        'card' => [
            'customer_id' => (int)$customer['id'],
            'customer_name' => $customer['name'],
            'phone' => $customer['phone'],
            'card_number' => $customer['user_code'],
            'points_balance' => $card ? (int)$card['tokens_earned'] : 0,
            'tokens_required' => $card ? (int)$card['tokens_required'] : 10,
            'card_id' => $card ? (int)$card['id'] : null,
            'card_status' => $card ? $card['status'] : 'none',
            'completed_cards' => (int)$completed['completed_count'],
        ],
    ], 'Customer found');

} catch (Exception $e) {
    apiResponse(false, null, 'Lookup failed: ' . $e->getMessage(), 500);
}
