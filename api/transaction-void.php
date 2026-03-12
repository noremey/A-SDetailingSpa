<?php
/**
 * Void Transaction — Reverse a loyalty or walk-in transaction
 * POST: { transaction_id, type ('loyalty'|'walkin'), reason }
 * Only super_admin can void
 * Loyalty void: reverse tokens, revert card, mark voided
 * Walk-in void: mark voided
 */
require_once __DIR__ . '/config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();

// Only super_admin can void
if ($admin['role'] !== 'super_admin') {
    apiResponse(false, null, 'Only Super Admin can void transactions', 403);
}

$db = getDB();
$input = getInput();

$transactionId = sanitizeInt($input['transaction_id'] ?? 0);
$type = sanitizeString($input['type'] ?? '');
$reason = sanitizeString($input['reason'] ?? 'Voided by admin');

if ($transactionId <= 0) {
    apiResponse(false, null, 'Transaction ID is required');
}
if (!in_array($type, ['loyalty', 'walkin'])) {
    apiResponse(false, null, 'Type must be loyalty or walkin');
}

// ========== VOID WALK-IN ==========
if ($type === 'walkin') {
    $stmt = $db->prepare("SELECT * FROM walkin_sales WHERE id = ?");
    $stmt->execute([$transactionId]);
    $sale = $stmt->fetch();

    if (!$sale) {
        apiResponse(false, null, 'Walk-in sale not found');
    }
    if ($sale['status'] === 'voided') {
        apiResponse(false, null, 'This transaction is already voided');
    }

    try {
        $stmt = $db->prepare("
            UPDATE walkin_sales
            SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ?
            WHERE id = ?
        ");
        $stmt->execute([$admin['user_id'], $reason, $transactionId]);

        logActivity($admin['user_id'], 'walkin_sale_voided', 'walkin_sale', $transactionId,
            "Walk-in sale " . currency() . number_format($sale['amount'], 2) . " voided: $reason",
            ['amount' => (float)$sale['amount'], 'reason' => $reason]
        );

        apiResponse(true, [
            'voided_id' => $transactionId,
            'type' => 'walkin',
            'amount' => (float)$sale['amount'],
        ], "Walk-in sale " . currency() . number_format($sale['amount'], 2) . " voided");

    } catch (Exception $e) {
        apiResponse(false, null, 'Failed to void: ' . $e->getMessage(), 500);
    }
}

// ========== VOID LOYALTY ==========
if ($type === 'loyalty') {
    $stmt = $db->prepare("SELECT * FROM transactions WHERE id = ?");
    $stmt->execute([$transactionId]);
    $txn = $stmt->fetch();

    if (!$txn) {
        apiResponse(false, null, 'Transaction not found');
    }
    if ($txn['status'] === 'voided') {
        apiResponse(false, null, 'This transaction is already voided');
    }

    $customerId = (int)$txn['user_id'];
    $cardId = $txn['card_id'] ? (int)$txn['card_id'] : null;
    $tokenCount = (int)$txn['token_count'];

    $db->beginTransaction();
    try {
        // 1. Mark transaction as voided
        $stmt = $db->prepare("
            UPDATE transactions
            SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ?
            WHERE id = ?
        ");
        $stmt->execute([$admin['user_id'], $reason, $transactionId]);

        // 2. Reverse tokens from card
        if ($cardId && $tokenCount > 0) {
            // Get current card state
            $stmt = $db->prepare("SELECT * FROM loyalty_cards WHERE id = ? FOR UPDATE");
            $stmt->execute([$cardId]);
            $card = $stmt->fetch();

            if ($card) {
                // Delete the tokens that were added by this transaction
                // Find tokens added around the transaction time by the same staff
                $stmt = $db->prepare("
                    SELECT id FROM tokens
                    WHERE card_id = ? AND user_id = ? AND added_by = ?
                    ORDER BY id DESC
                    LIMIT ?
                ");
                $stmt->execute([$cardId, $customerId, (int)$txn['added_by'], $tokenCount]);
                $tokensToRemove = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if (!empty($tokensToRemove)) {
                    $placeholders = implode(',', array_fill(0, count($tokensToRemove), '?'));
                    $stmt = $db->prepare("DELETE FROM tokens WHERE id IN ($placeholders)");
                    $stmt->execute($tokensToRemove);
                }

                // Recalculate card tokens
                $stmt = $db->prepare("SELECT COUNT(*) FROM tokens WHERE card_id = ?");
                $stmt->execute([$cardId]);
                $actualTokens = (int)$stmt->fetchColumn();

                // Update card
                if ($actualTokens <= 0) {
                    // Card now empty — if it was the only transaction, card should stay active with 0
                    $stmt = $db->prepare("UPDATE loyalty_cards SET tokens_earned = 0, status = 'active', completed_at = NULL WHERE id = ?");
                    $stmt->execute([$cardId]);
                } else {
                    $newStatus = ($actualTokens >= (int)$card['tokens_required']) ? 'completed' : 'active';
                    $completedAt = ($newStatus === 'completed') ? $card['completed_at'] : null;
                    $stmt = $db->prepare("UPDATE loyalty_cards SET tokens_earned = ?, status = ?, completed_at = ? WHERE id = ?");
                    $stmt->execute([$actualTokens, $newStatus, $completedAt, $cardId]);
                }

                logActivity($admin['user_id'], 'tokens_reversed', 'card', $cardId,
                    "Reversed $tokenCount token(s) from Card #{$card['card_number']} (void)",
                    ['tokens_removed' => count($tokensToRemove), 'card_id' => $cardId, 'transaction_id' => $transactionId]
                );
            }
        }

        $db->commit();

        // Get customer name for response
        $stmt = $db->prepare("SELECT name FROM users WHERE id = ?");
        $stmt->execute([$customerId]);
        $customerName = $stmt->fetchColumn() ?: 'Unknown';

        logActivity($admin['user_id'], 'transaction_voided', 'transaction', $transactionId,
            "Transaction #{$transactionId} voided for {$customerName} (" . currency() . number_format($txn['amount'], 2) . "): $reason",
            ['amount' => (float)$txn['amount'], 'customer_id' => $customerId, 'tokens_reversed' => $tokenCount, 'reason' => $reason]
        );

        apiResponse(true, [
            'voided_id' => $transactionId,
            'type' => 'loyalty',
            'amount' => (float)$txn['amount'],
            'tokens_reversed' => $tokenCount,
            'customer_name' => $customerName,
        ], "Transaction voided — {$tokenCount} token(s) reversed for {$customerName}");

    } catch (Exception $e) {
        $db->rollBack();
        apiResponse(false, null, 'Failed to void: ' . $e->getMessage(), 500);
    }
}
