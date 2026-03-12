<?php
/**
 * Active Card + Tokens
 * GET: Returns active/completed card with token details
 * Settings fetched from live API
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = requireLogin();
$db = getDB();

// Get active card
$stmt = $db->prepare("
    SELECT id, card_number, tokens_required, tokens_earned, status, created_at
    FROM loyalty_cards
    WHERE user_id = ? AND status = 'active'
    LIMIT 1
");
$stmt->execute([$userId]);
$card = $stmt->fetch();

// If no active, check for completed card awaiting redemption
if (!$card) {
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
               v.plate_number
        FROM tokens t
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
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

// Fetch settings from live API
$liveData = fetchLiveSettings();
$settings = [];

if ($liveData) {
    $settings = $liveData['settings'];
    if (!empty($settings['business_logo'])) {
        $settings['business_logo'] = getLogoProxyUrl();
    }
}

// Fallback to local DB if live API fails
if (empty($settings)) {
    $settings = getSettings([
        'business_name', 'business_logo', 'business_type',
        'reward_description', 'primary_color', 'secondary_color',
        'tokens_per_card', 'require_vehicle'
    ]);
}

jsonResponse(true, [
    'card'     => $card,
    'settings' => $settings
]);
