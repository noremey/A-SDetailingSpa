<?php
/**
 * POS Loyalty Payment - Add token(s) + record transaction
 * POST: { customer_id, amount }
 * Tokens awarded = floor(amount / min_spend) when min_spend enabled
 * Requires JWT auth (staff/admin)
 */
require_once __DIR__ . '/staff-config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();
$db = getDB();
$input = getInput();

$customerId = sanitizeInt($input['customer_id'] ?? 0);
$amount     = sanitizeFloat($input['amount'] ?? 0);

if ($customerId <= 0) {
    apiResponse(false, null, 'Customer ID is required');
}
if ($amount <= 0) {
    apiResponse(false, null, 'Amount must be greater than 0');
}

// Verify customer exists
$stmt = $db->prepare("SELECT id, name, user_code FROM users WHERE id = ? AND role = 'customer' AND status = 'active'");
$stmt->execute([$customerId]);
$customer = $stmt->fetch();
if (!$customer) {
    apiResponse(false, null, 'Customer not found');
}

// Get settings
$settings = getSettings(['min_spend_enabled', 'min_spend', 'payment_tracking_enabled', 'tokens_per_card', 'reward_description']);
$tokensPerCard = (int)($settings['tokens_per_card'] ?: 10);

// Calculate how many tokens to award
$minSpend = (float)($settings['min_spend'] ?: 30);
if ($settings['min_spend_enabled'] === '1' && $minSpend > 0) {
    $tokenCount = (int)floor($amount / $minSpend);
    if ($tokenCount <= 0) {
        apiResponse(false, null, "Minimum spend of " . currency() . number_format($minSpend, 2) . " required to earn a token");
    }
} else {
    $tokenCount = 1;
}

// Cap to safe max
$tokenCount = min($tokenCount, 100);

// Calculate amount per token
$amountPerToken = ($settings['payment_tracking_enabled'] === '1' && $amount > 0)
    ? round($amount / $tokenCount, 2)
    : null;

$db->beginTransaction();
try {
    $tokensAdded = 0;
    $isCompleted = false;
    $card = null;

    for ($i = 0; $i < $tokenCount; $i++) {
        // Get or create active card (row lock)
        $stmt = $db->prepare("
            SELECT id, card_number, tokens_required, tokens_earned
            FROM loyalty_cards
            WHERE user_id = ? AND status = 'active'
            FOR UPDATE
        ");
        $stmt->execute([$customerId]);
        $card = $stmt->fetch();

        if (!$card) {
            // Create new card
            $stmt = $db->prepare("SELECT COALESCE(MAX(card_number), 0) FROM loyalty_cards WHERE user_id = ?");
            $stmt->execute([$customerId]);
            $nextCardNum = (int)$stmt->fetchColumn() + 1;

            $stmt = $db->prepare("
                INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status)
                VALUES (?, ?, ?, 0, 'active')
            ");
            $stmt->execute([$customerId, $nextCardNum, $tokensPerCard]);
            $card = [
                'id' => (int)$db->lastInsertId(),
                'card_number' => $nextCardNum,
                'tokens_required' => $tokensPerCard,
                'tokens_earned' => 0,
            ];
        }

        // Safety: skip if card already full
        if ((int)$card['tokens_earned'] >= (int)$card['tokens_required']) {
            continue;
        }

        $tokenPosition = (int)$card['tokens_earned'] + 1;

        // First token gets rounding remainder
        $tokenAmount = $amountPerToken;
        if ($i === 0 && $amountPerToken !== null) {
            $tokenAmount = round($amount - ($amountPerToken * ($tokenCount - 1)), 2);
        }

        $stmt = $db->prepare("
            INSERT INTO tokens (card_id, user_id, added_by, vehicle_id, token_position, amount, notes)
            VALUES (?, ?, ?, NULL, ?, ?, 'POS Payment')
        ");
        $stmt->execute([
            $card['id'],
            $customerId,
            $admin['user_id'],
            $tokenPosition,
            $tokenAmount,
        ]);
        $tokenId = (int)$db->lastInsertId();
        $tokensAdded++;

        // Update card
        $newTokenCount = (int)$card['tokens_earned'] + 1;
        $isCompleted = ($newTokenCount >= (int)$card['tokens_required']);

        if ($isCompleted) {
            $stmt = $db->prepare("
                UPDATE loyalty_cards SET tokens_earned = ?, status = 'completed', completed_at = NOW() WHERE id = ?
            ");
            $stmt->execute([$newTokenCount, $card['id']]);

            logActivity($admin['user_id'], 'card_completed', 'card', $card['id'],
                "Card #{$card['card_number']} completed for {$customer['name']} (POS)",
                ['customer_id' => $customerId]
            );
        } else {
            $stmt = $db->prepare("UPDATE loyalty_cards SET tokens_earned = ? WHERE id = ?");
            $stmt->execute([$newTokenCount, $card['id']]);
        }

        logActivity($admin['user_id'], 'token_added', 'token', $tokenId,
            "POS Token #{$tokenPosition} added for {$customer['name']}",
            ['card_id' => $card['id'], 'amount' => $tokenAmount, 'customer_id' => $customerId, 'source' => 'pos']
        );

        // Update card variable for next loop
        $card['tokens_earned'] = $newTokenCount;
    }

    // Record transaction
    $stmt = $db->prepare("
        INSERT INTO transactions (user_id, vehicle_id, card_id, amount, token_count, notes, added_by)
        VALUES (?, NULL, ?, ?, ?, 'POS Payment', ?)
    ");
    $stmt->execute([$customerId, $card ? $card['id'] : null, $amount, $tokensAdded, $admin['user_id']]);
    $transactionId = (int)$db->lastInsertId();

    $db->commit();

    // Send push notification to customer
    try {
        require_once __DIR__ . '/../../api/helpers/send-push.php';
        $businessName = getSetting('business_name') ?: 'Loyalty Card';
        if ($isCompleted) {
            $rewardDesc = $settings['reward_description'] ?? 'FREE reward';
            notifyUser($customerId, 'Card Complete!',
                "Tahniah! Kad loyalti anda penuh. Tebus ganjaran: $rewardDesc",
                '/users/');
        } else {
            notifyUser($customerId, $businessName,
                "+$tokensAdded token ditambah. " . ($card['tokens_earned']) . "/" . ($card['tokens_required']) . " selesai.",
                '/users/');
        }
    } catch (\Exception $e) { /* push should never break flow */ }

    // Re-fetch latest card
    $stmt = $db->prepare("
        SELECT id, card_number, tokens_required, tokens_earned, status
        FROM loyalty_cards
        WHERE user_id = ? AND status IN ('active', 'completed')
        ORDER BY card_number DESC
        LIMIT 1
    ");
    $stmt->execute([$customerId]);
    $latestCard = $stmt->fetch();

    $tokenWord = $tokensAdded === 1 ? 'token' : 'tokens';
    $message = $isCompleted
        ? "Card complete! {$customer['name']} earned a FREE reward! (+{$tokensAdded} {$tokenWord})"
        : "{$tokensAdded} {$tokenWord} added for {$customer['name']}";

    apiResponse(true, [
        'transaction_id' => $transactionId,
        'tokens_added' => $tokensAdded,
        'card' => [
            'tokens_earned' => $latestCard ? (int)$latestCard['tokens_earned'] : $newTokenCount,
            'tokens_required' => $latestCard ? (int)$latestCard['tokens_required'] : (int)$card['tokens_required'],
            'status' => $latestCard ? $latestCard['status'] : ($isCompleted ? 'completed' : 'active'),
            'is_completed' => $latestCard ? ($latestCard['status'] === 'completed') : $isCompleted,
        ],
        'points_earned' => $tokensAdded,
        'reward_description' => $settings['reward_description'] ?? '',
    ], $message);

} catch (Exception $e) {
    $db->rollBack();
    apiResponse(false, null, 'Payment failed: ' . $e->getMessage(), 500);
}
