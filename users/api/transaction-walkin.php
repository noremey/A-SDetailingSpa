<?php
/**
 * POS Walk-in Transaction
 * POST: { amount } - Records a walk-in sale
 * Requires JWT auth (staff/admin)
 */
require_once __DIR__ . '/staff-config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();
$db = getDB();
$input = getInput();

$amount = sanitizeFloat($input['amount'] ?? 0);

if ($amount <= 0) {
    apiResponse(false, null, 'Amount must be greater than 0');
}

try {
    $stmt = $db->prepare("
        INSERT INTO walkin_sales (customer_name, amount, notes, added_by) VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([null, $amount, 'POS Walk-in', $admin['user_id']]);
    $saleId = (int)$db->lastInsertId();

    logActivity($admin['user_id'], 'walkin_sale_added', 'walkin_sale', $saleId,
        "POS Walk-in sale " . currency() . number_format($amount, 2),
        ['amount' => $amount, 'source' => 'pos']
    );

    // Fetch the inserted record
    $stmt = $db->prepare("SELECT * FROM walkin_sales WHERE id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();

    apiResponse(true, [
        'transaction_id' => $saleId,
        'amount' => (float)$sale['amount'],
        'created_at' => $sale['created_at'],
    ], "Walk-in sale recorded");

} catch (Exception $e) {
    apiResponse(false, null, 'Failed to record sale: ' . $e->getMessage(), 500);
}
