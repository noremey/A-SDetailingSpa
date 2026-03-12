<?php
/**
 * Edit Transaction Amount — Update amount on a walk-in sale ONLY
 * POST: { transaction_id, amount, payment_method?, cash_amount?, online_amount? }
 * Only super_admin can edit
 * Loyalty transactions cannot be edited (void + re-create instead)
 */
require_once __DIR__ . '/config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();

// Only super_admin can edit amount
if ($admin['role'] !== 'super_admin') {
    apiResponse(false, null, 'Only Super Admin can edit transaction amount', 403);
}

$db = getDB();
$input = getInput();

$transactionId = sanitizeInt($input['transaction_id'] ?? 0);
$newAmount = isset($input['amount']) ? round((float)$input['amount'], 2) : 0;
$paymentMethod = sanitizeString($input['payment_method'] ?? '');
$cashAmount = isset($input['cash_amount']) ? round((float)$input['cash_amount'], 2) : null;
$onlineAmount = isset($input['online_amount']) ? round((float)$input['online_amount'], 2) : null;

if ($transactionId <= 0) {
    apiResponse(false, null, 'Transaction ID is required');
}
if ($newAmount <= 0) {
    apiResponse(false, null, 'Amount must be greater than 0');
}
if ($paymentMethod && !in_array($paymentMethod, ['cash', 'online', 'split'])) {
    apiResponse(false, null, 'Payment method must be cash, online, or split');
}

// Only walk-in sales can have amount edited
$stmt = $db->prepare("SELECT * FROM walkin_sales WHERE id = ?");
$stmt->execute([$transactionId]);
$sale = $stmt->fetch();

if (!$sale) {
    apiResponse(false, null, 'Walk-in sale not found');
}
if ($sale['status'] === 'voided') {
    apiResponse(false, null, 'Cannot edit a voided transaction');
}

$oldAmount = (float)$sale['amount'];
$oldMethod = $sale['payment_method'] ?? 'cash';

// Use existing method if not provided
if (!$paymentMethod) {
    $paymentMethod = $oldMethod;
}

// Auto-calculate amounts based on method
if ($paymentMethod === 'cash') {
    $cashAmount = $newAmount;
    $onlineAmount = null;
} elseif ($paymentMethod === 'online') {
    $cashAmount = null;
    $onlineAmount = $newAmount;
} elseif ($paymentMethod === 'split') {
    if ($cashAmount === null || $cashAmount <= 0) {
        apiResponse(false, null, 'Cash amount is required for split payment');
    }
    if ($cashAmount >= $newAmount) {
        apiResponse(false, null, 'Cash amount must be less than total');
    }
    $onlineAmount = round($newAmount - $cashAmount, 2);
}

try {
    $stmt = $db->prepare("
        UPDATE walkin_sales
        SET amount = ?, payment_method = ?, cash_amount = ?, online_amount = ?
        WHERE id = ?
    ");
    $stmt->execute([$newAmount, $paymentMethod, $cashAmount, $onlineAmount, $transactionId]);

    logActivity($admin['user_id'], 'walkin_amount_edited', 'walkin_sale', $transactionId,
        "Walk-in #$transactionId amount changed from " . currency() . number_format($oldAmount, 2) . " to " . currency() . number_format($newAmount, 2),
        [
            'old_amount' => $oldAmount,
            'new_amount' => $newAmount,
            'old_method' => $oldMethod,
            'new_method' => $paymentMethod,
            'cash_amount' => $cashAmount,
            'online_amount' => $onlineAmount,
        ]
    );

    apiResponse(true, [
        'id' => $transactionId,
        'amount' => $newAmount,
        'payment_method' => $paymentMethod,
        'cash_amount' => $cashAmount,
        'online_amount' => $onlineAmount,
    ], "Amount updated to " . currency() . number_format($newAmount, 2));

} catch (Exception $e) {
    apiResponse(false, null, 'Failed to update: ' . $e->getMessage(), 500);
}
