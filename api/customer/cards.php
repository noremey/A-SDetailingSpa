<?php
/**
 * Customer Card Management
 * GET action=active: Get active card with tokens
 * GET action=all: Get all cards (history)
 */
require_once __DIR__ . '/../config/app.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$action = sanitizeString($_GET['action'] ?? 'active');

// Allow admin to view customer cards via user_id param
$authUser = requireAuth();
if (isset($_GET['user_id']) && in_array($authUser['role'], ['admin', 'super_admin'])) {
    $userId = sanitizeInt($_GET['user_id']);
} else {
    $userId = $authUser['user_id'];
}

$db = getDB();

if ($action === 'active') {
    // Get active card with tokens
    $stmt = $db->prepare("
        SELECT id, card_number, tokens_required, tokens_earned, status, created_at
        FROM loyalty_cards
        WHERE user_id = ? AND status = 'active'
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $card = $stmt->fetch();

    if (!$card) {
        // Also check for completed card awaiting redemption
        $stmt = $db->prepare("
            SELECT id, card_number, tokens_required, tokens_earned, status, completed_at, created_at
            FROM loyalty_cards
            WHERE user_id = ? AND status = 'completed'
            ORDER BY completed_at DESC
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $card = $stmt->fetch();
    }

    if ($card) {
        $card['id'] = (int)$card['id'];
        $card['tokens_required'] = (int)$card['tokens_required'];
        $card['tokens_earned'] = (int)$card['tokens_earned'];

        // Get tokens for this card
        $stmt = $db->prepare("
            SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
                   u.name as added_by_name
            FROM tokens t
            LEFT JOIN users u ON t.added_by = u.id
            WHERE t.card_id = ?
            ORDER BY t.token_position ASC
        ");
        $stmt->execute([$card['id']]);
        $card['tokens'] = $stmt->fetchAll();

        // Total amount spent on this card
        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE card_id = ? AND amount IS NOT NULL");
        $stmt->execute([$card['id']]);
        $card['total_amount'] = (float)$stmt->fetchColumn();
    }

    // Get settings for display
    $settings = getSettings([
        'business_name', 'business_logo', 'business_type',
        'reward_description', 'primary_color', 'secondary_color'
    ]);

    apiResponse(true, [
        'card' => $card,
        'settings' => $settings
    ]);

} elseif ($action === 'all') {
    // All cards (history)
    $stmt = $db->prepare("
        SELECT id, card_number, tokens_required, tokens_earned, status,
               completed_at, redeemed_at, created_at
        FROM loyalty_cards
        WHERE user_id = ?
        ORDER BY card_number DESC
    ");
    $stmt->execute([$userId]);
    $cards = $stmt->fetchAll();

    foreach ($cards as &$card) {
        $card['id'] = (int)$card['id'];
        $card['tokens_required'] = (int)$card['tokens_required'];
        $card['tokens_earned'] = (int)$card['tokens_earned'];

        // Get tokens
        $stmt2 = $db->prepare("
            SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
                   u.name as added_by_name
            FROM tokens t
            LEFT JOIN users u ON t.added_by = u.id
            WHERE t.card_id = ?
            ORDER BY t.token_position ASC
        ");
        $stmt2->execute([$card['id']]);
        $card['tokens'] = $stmt2->fetchAll();

        // Total amount spent on this card
        $stmt2 = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE card_id = ? AND amount IS NOT NULL");
        $stmt2->execute([$card['id']]);
        $card['total_amount'] = (float)$stmt2->fetchColumn();
    }

    // Redemption info
    $stmt = $db->prepare("
        SELECT r.card_id, r.reward_description, r.redeemed_at, u.name as processed_by_name
        FROM redemptions r
        LEFT JOIN users u ON r.processed_by = u.id
        WHERE r.user_id = ?
    ");
    $stmt->execute([$userId]);
    $redemptions = [];
    while ($row = $stmt->fetch()) {
        $redemptions[$row['card_id']] = $row;
    }

    // Total stats
    $stmt = $db->prepare("SELECT COUNT(*) FROM tokens WHERE user_id = ?");
    $stmt->execute([$userId]);
    $totalTokens = (int)$stmt->fetchColumn();

    $stmt = $db->prepare("SELECT COUNT(*) FROM redemptions WHERE user_id = ?");
    $stmt->execute([$userId]);
    $totalRedemptions = (int)$stmt->fetchColumn();

    apiResponse(true, [
        'cards'       => $cards,
        'redemptions' => $redemptions,
        'stats'       => [
            'total_tokens'      => $totalTokens,
            'total_redemptions' => $totalRedemptions,
            'total_cards'       => count($cards)
        ]
    ]);
}
