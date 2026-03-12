<?php
/**
 * Walk-in Sales - Quick sale recording for non-registered customers
 * POST action=add: Record a walk-in sale
 * POST action=delete: Delete a walk-in sale entry
 * GET action=today: Get today's sales + summary stats
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = getInput();
    $action = sanitizeString($input['action'] ?? '');

    if ($action === 'add') {
        $amount        = sanitizeFloat($input['amount'] ?? 0);
        $discount      = sanitizeFloat($input['discount'] ?? 0);
        $customerName  = sanitizeString($input['customer_name'] ?? '');
        $notes         = sanitizeString($input['notes'] ?? '');
        $paymentMethod = sanitizeString($input['payment_method'] ?? 'cash');
        $cashAmount    = isset($input['cash_amount']) ? sanitizeFloat($input['cash_amount']) : null;
        $onlineAmount  = isset($input['online_amount']) ? sanitizeFloat($input['online_amount']) : null;

        if ($amount <= 0) {
            apiResponse(false, null, 'Amount must be greater than 0');
        }
        // Validate discount
        if ($discount < 0) $discount = 0;
        if ($discount > $amount + $discount) $discount = 0; // safety check

        if (!in_array($paymentMethod, ['cash', 'online', 'split'])) {
            $paymentMethod = 'cash';
        }
        if ($paymentMethod === 'cash') {
            $cashAmount = $amount;
            $onlineAmount = null;
        } elseif ($paymentMethod === 'online') {
            $cashAmount = null;
            $onlineAmount = $amount;
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO walkin_sales (customer_name, amount, discount, notes, added_by, payment_method, cash_amount, online_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$customerName ?: null, $amount, $discount, $notes ?: null, $admin['user_id'], $paymentMethod, $cashAmount, $onlineAmount]);
            $saleId = (int)$db->lastInsertId();

            $nameLabel = $customerName ? " ($customerName)" : "";
            logActivity($admin['user_id'], 'walkin_sale_added', 'walkin_sale', $saleId,
                "Walk-in sale " . currency() . number_format($amount, 2) . $nameLabel . ($notes ? " - $notes" : ""),
                ['amount' => $amount, 'customer_name' => $customerName, 'notes' => $notes]
            );

            // Fetch the inserted record
            $stmt = $db->prepare("
                SELECT ws.*, u.name as added_by_name
                FROM walkin_sales ws
                LEFT JOIN users u ON ws.added_by = u.id
                WHERE ws.id = ?
            ");
            $stmt->execute([$saleId]);
            $sale = $stmt->fetch();

            // Get updated today summary (exclude voided)
            $stmt = $db->query("
                SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
                FROM walkin_sales WHERE DATE(created_at) = CURDATE() AND status = 'active'
            ");
            $summary = $stmt->fetch();

            apiResponse(true, [
                'sale' => $sale,
                'today_total' => (float)$summary['total'],
                'today_count' => (int)$summary['count'],
            ], currency() . number_format($amount, 2) . " recorded");

        } catch (Exception $e) {
            apiResponse(false, null, 'Failed to record sale: ' . $e->getMessage(), 500);
        }

    } elseif ($action === 'delete') {
        // Only super_admin can delete
        if ($admin['role'] !== 'super_admin') {
            apiResponse(false, null, 'Only Super Admin can delete sales', 403);
        }

        $saleId = sanitizeInt($input['id'] ?? 0);
        if ($saleId <= 0) apiResponse(false, null, 'Sale ID is required');

        // Get the sale first for logging
        $stmt = $db->prepare("SELECT * FROM walkin_sales WHERE id = ?");
        $stmt->execute([$saleId]);
        $sale = $stmt->fetch();
        if (!$sale) apiResponse(false, null, 'Sale not found');

        try {
            $stmt = $db->prepare("DELETE FROM walkin_sales WHERE id = ?");
            $stmt->execute([$saleId]);

            logActivity($admin['user_id'], 'walkin_sale_deleted', 'walkin_sale', $saleId,
                "Walk-in sale " . currency() . number_format($sale['amount'], 2) . " deleted",
                ['amount' => $sale['amount']]
            );

            // Get updated today summary (exclude voided)
            $stmt = $db->query("
                SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
                FROM walkin_sales WHERE DATE(created_at) = CURDATE() AND status = 'active'
            ");
            $summary = $stmt->fetch();

            apiResponse(true, [
                'today_total' => (float)$summary['total'],
                'today_count' => (int)$summary['count'],
            ], 'Sale deleted');

        } catch (Exception $e) {
            apiResponse(false, null, 'Failed to delete sale: ' . $e->getMessage(), 500);
        }
    }

} elseif ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'today');

    if ($action === 'today') {
        // Today's sales list (active only — voided ones visible in Transaction History)
        $stmt = $db->query("
            SELECT ws.*, u.name as added_by_name
            FROM walkin_sales ws
            LEFT JOIN users u ON ws.added_by = u.id
            WHERE DATE(ws.created_at) = CURDATE() AND ws.status = 'active'
            ORDER BY ws.created_at DESC
        ");
        $sales = $stmt->fetchAll();

        // Today summary (exclude voided)
        $stmt = $db->query("
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
            FROM walkin_sales WHERE DATE(created_at) = CURDATE() AND status = 'active'
        ");
        $todaySummary = $stmt->fetch();

        // Week total (current week, exclude voided)
        $stmt = $db->query("
            SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
            FROM walkin_sales
            WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) AND status = 'active'
        ");
        $weekSummary = $stmt->fetch();

        // Month total (exclude voided)
        $stmt = $db->query("
            SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
            FROM walkin_sales
            WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'active'
        ");
        $monthSummary = $stmt->fetch();

        apiResponse(true, [
            'sales'        => $sales,
            'today_total'  => (float)$todaySummary['total'],
            'today_count'  => (int)$todaySummary['count'],
            'week_total'   => (float)$weekSummary['total'],
            'week_count'   => (int)$weekSummary['count'],
            'month_total'  => (float)$monthSummary['total'],
            'month_count'  => (int)$monthSummary['count'],
        ]);
    }
}
