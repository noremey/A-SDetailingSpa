<?php
/**
 * Card History
 * GET: All cards with tokens, redemptions, stats
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = requireLogin();
$db = getDB();

// All cards
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

    // Tokens for this card
    $stmt2 = $db->prepare("
        SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
               v.plate_number
        FROM tokens t
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE t.card_id = ?
        ORDER BY t.token_position ASC
    ");
    $stmt2->execute([$card['id']]);
    $card['tokens'] = $stmt2->fetchAll();

    // Total amount
    $stmt2 = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE card_id = ? AND amount IS NOT NULL");
    $stmt2->execute([$card['id']]);
    $card['total_amount'] = (float)$stmt2->fetchColumn();
}

// Redemptions
$stmt = $db->prepare("
    SELECT r.card_id, r.reward_description, r.redeemed_at
    FROM redemptions r
    WHERE r.user_id = ?
");
$stmt->execute([$userId]);
$redemptions = [];
while ($row = $stmt->fetch()) {
    $redemptions[$row['card_id']] = $row;
}

// Stats
$stmt = $db->prepare("SELECT COUNT(*) FROM tokens WHERE user_id = ?");
$stmt->execute([$userId]);
$totalTokens = (int)$stmt->fetchColumn();

$stmt = $db->prepare("SELECT COUNT(*) FROM redemptions WHERE user_id = ?");
$stmt->execute([$userId]);
$totalRedemptions = (int)$stmt->fetchColumn();

$stmt = $db->prepare("SELECT COALESCE(SUM(t.amount), 0) FROM tokens t WHERE t.user_id = ? AND t.amount IS NOT NULL");
$stmt->execute([$userId]);
$totalSpent = (float)$stmt->fetchColumn();

jsonResponse(true, [
    'cards'       => $cards,
    'redemptions' => $redemptions,
    'stats'       => [
        'total_tokens'      => $totalTokens,
        'total_redemptions' => $totalRedemptions,
        'total_cards'       => count($cards),
        'total_spent'       => $totalSpent
    ]
]);
