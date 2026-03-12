<?php
/**
 * Edit Payment Method — Update payment method on an existing transaction
 * POST: { transaction_id, type ('loyalty'|'walkin'), payment_method, cash_amount?, online_amount? }
 * Only super_admin can edit
 */
require_once __DIR__ . '/config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();

// Only super_admin can edit payment method
if ($admin['role'] !== 'super_admin') {
    apiResponse(false, null, 'Only Super Admin can edit payment method', 403);
}

$db = getDB();
$input = getInput();

$transactionId = sanitizeInt($input['transaction_id'] ?? 0);
$type = sanitizeString($input['type'] ?? '');
$paymentMethod = sanitizeString($input['payment_method'] ?? '');
$cashAmount = isset($input['cash_amount']) ? round((float)$input['cash_amount'], 2) : null;
$onlineAmount = isset($input['online_amount']) ? round((float)$input['online_amount'], 2) : null;

if ($transactionId <= 0) {
    apiResponse(false, null, 'Transaction ID is required');
}
if (!in_array($type, ['loyalty', 'walkin'])) {
    apiResponse(false, null, 'Type must be loyalty or walkin');
}
if (!in_array($paymentMethod, ['cash', 'online', 'split'])) {
    apiResponse(false, null, 'Payment method must be cash, online, or split');
}

// Determine table
$table = ($type === 'loyalty') ? 'transactions' : 'walkin_sales';

// Fetch existing transaction
$stmt = $db->prepare("SELECT * FROM $table WHERE id = ?");
$stmt->execute([$transactionId]);
$txn = $stmt->fetch();

if (!$txn) {
    apiResponse(false, null, 'Transaction not found');
}
if ($txn['status'] === 'voided') {
    apiResponse(false, null, 'Cannot edit a voided transaction');
}

$amount = (float)$txn['amount'];
$oldMethod = $txn['payment_method'] ?? 'cash';

// Auto-calculate amounts based on method
if ($paymentMethod === 'cash') {
    $cashAmount = $amount;
    $onlineAmount = null;
} elseif ($paymentMethod === 'online') {
    $cashAmount = null;
    $onlineAmount = $amount;
} elseif ($paymentMethod === 'split') {
    if ($cashAmount === null || $cashAmount <= 0) {
        apiResponse(false, null, 'Cash amount is required for split payment');
    }
    if ($cashAmount >= $amount) {
        apiResponse(false, null, 'Cash amount must be less than total');
    }
    $onlineAmount = round($amount - $cashAmount, 2);
}

try {
    $stmt = $db->prepare("
        UPDATE $table
        SET payment_method = ?, cash_amount = ?, online_amount = ?
        WHERE id = ?
    ");
    $stmt->execute([$paymentMethod, $cashAmount, $onlineAmount, $transactionId]);

    logActivity($admin['user_id'], 'payment_method_edited', $type === 'loyalty' ? 'transaction' : 'walkin_sale', $transactionId,
        "Payment method changed from $oldMethod to $paymentMethod on #$transactionId",
        ['old_method' => $oldMethod, 'new_method' => $paymentMethod, 'cash_amount' => $cashAmount, 'online_amount' => $onlineAmount]
    );

    apiResponse(true, [
        'id' => $transactionId,
        'type' => $type,
        'payment_method' => $paymentMethod,
        'cash_amount' => $cashAmount,
        'online_amount' => $onlineAmount,
    ], "Payment method updated to $paymentMethod");

} catch (Exception $e) {
    apiResponse(false, null, 'Failed to update: ' . $e->getMessage(), 500);
}
