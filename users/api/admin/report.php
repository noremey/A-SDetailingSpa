<?php
/**
 * Admin Report API
 * GET: Returns report data by day, month, or year
 *
 * Params:
 *   view: 'day' | 'month' | 'year'
 *   year: YYYY
 *   month: 1-12 (for day view)
 */
require_once __DIR__ . '/../staff-config.php';

$admin = requireAdmin();
$db = getDB();

$view = isset($_GET['view']) ? sanitizeString($_GET['view']) : 'month';
$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');

// Validate
$currentYear = (int)date('Y');
if ($year < $currentYear || $year > $currentYear + 11) $year = $currentYear;
if ($month < 1 || $month > 12) $month = (int)date('m');

$settings = getSettings(['currency_symbol']);
$currency = $settings['currency_symbol'] ?? 'RM';

if ($view === 'year') {
    // ============================================
    // YEARLY REPORT
    // ============================================
    $endYear = $currentYear + 11;

    $stmt = $db->prepare("
        SELECT
            YEAR(t.created_at) as period,
            COUNT(t.id) as total_tokens,
            COALESCE(SUM(t.amount), 0) as total_revenue,
            COUNT(DISTINCT t.user_id) as unique_customers,
            COUNT(DISTINCT t.vehicle_id) as unique_vehicles
        FROM tokens t
        WHERE YEAR(t.created_at) BETWEEN ? AND ?
        GROUP BY YEAR(t.created_at)
        ORDER BY period ASC
    ");
    $stmt->execute([$currentYear, $endYear]);
    $tokenData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Redemptions by year
    $stmt2 = $db->prepare("
        SELECT YEAR(r.redeemed_at) as period, COUNT(r.id) as total_redemptions
        FROM redemptions r
        WHERE YEAR(r.redeemed_at) BETWEEN ? AND ?
        GROUP BY YEAR(r.redeemed_at)
    ");
    $stmt2->execute([$currentYear, $endYear]);
    $redeemData = [];
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $redeemData[(int)$row['period']] = (int)$row['total_redemptions'];
    }

    // New customers by year
    $stmt3 = $db->prepare("
        SELECT YEAR(created_at) as period, COUNT(id) as new_customers
        FROM users
        WHERE role = 'customer' AND YEAR(created_at) BETWEEN ? AND ?
        GROUP BY YEAR(created_at)
    ");
    $stmt3->execute([$currentYear, $endYear]);
    $customerData = [];
    foreach ($stmt3->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $customerData[(int)$row['period']] = (int)$row['new_customers'];
    }

    // Walk-in sales by year
    $stmtW = $db->prepare("
        SELECT YEAR(created_at) as period, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
        FROM walkin_sales
        WHERE YEAR(created_at) BETWEEN ? AND ?
        GROUP BY YEAR(created_at)
    ");
    $stmtW->execute([$currentYear, $endYear]);
    $walkinData = [];
    foreach ($stmtW->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $walkinData[(int)$row['period']] = ['revenue' => (float)$row['revenue'], 'count' => (int)$row['count']];
    }

    $lookup = [];
    foreach ($tokenData as $row) {
        $lookup[(int)$row['period']] = $row;
    }

    $rows = [];
    $grandTotals = ['total_tokens' => 0, 'total_revenue' => 0, 'total_redemptions' => 0, 'new_customers' => 0, 'unique_customers' => 0, 'walkin_revenue' => 0, 'walkin_count' => 0];

    for ($y = $currentYear; $y <= $endYear; $y++) {
        $d = $lookup[$y] ?? null;
        $memberRev = $d ? (float)$d['total_revenue'] : 0;
        $walkinRev = $walkinData[$y]['revenue'] ?? 0;
        $walkinCnt = $walkinData[$y]['count'] ?? 0;
        $entry = [
            'period' => (string)$y,
            'label' => (string)$y,
            'total_tokens' => $d ? (int)$d['total_tokens'] : 0,
            'total_revenue' => $memberRev + $walkinRev,
            'member_revenue' => $memberRev,
            'walkin_revenue' => $walkinRev,
            'walkin_count' => $walkinCnt,
            'unique_customers' => $d ? (int)$d['unique_customers'] : 0,
            'total_redemptions' => $redeemData[$y] ?? 0,
            'new_customers' => $customerData[$y] ?? 0,
        ];
        $grandTotals['total_tokens'] += $entry['total_tokens'];
        $grandTotals['total_revenue'] += $entry['total_revenue'];
        $grandTotals['total_redemptions'] += $entry['total_redemptions'];
        $grandTotals['new_customers'] += $entry['new_customers'];
        $grandTotals['walkin_revenue'] += $walkinRev;
        $grandTotals['walkin_count'] += $walkinCnt;
        $rows[] = $entry;
    }

    apiResponse(true, [
        'view' => 'year',
        'rows' => $rows,
        'totals' => $grandTotals,
    ]);

} elseif ($view === 'month') {
    // ============================================
    // MONTHLY REPORT
    // ============================================
    $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    $stmt = $db->prepare("
        SELECT
            MONTH(t.created_at) as period,
            COUNT(t.id) as total_tokens,
            COALESCE(SUM(t.amount), 0) as total_revenue,
            COUNT(DISTINCT t.user_id) as unique_customers,
            COUNT(DISTINCT t.vehicle_id) as unique_vehicles
        FROM tokens t
        WHERE YEAR(t.created_at) = ?
        GROUP BY MONTH(t.created_at)
        ORDER BY period ASC
    ");
    $stmt->execute([$year]);
    $tokenData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt2 = $db->prepare("
        SELECT MONTH(redeemed_at) as period, COUNT(id) as total_redemptions
        FROM redemptions WHERE YEAR(redeemed_at) = ?
        GROUP BY MONTH(redeemed_at)
    ");
    $stmt2->execute([$year]);
    $redeemData = [];
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $redeemData[(int)$row['period']] = (int)$row['total_redemptions'];
    }

    $stmt3 = $db->prepare("
        SELECT MONTH(created_at) as period, COUNT(id) as new_customers
        FROM users WHERE role = 'customer' AND YEAR(created_at) = ?
        GROUP BY MONTH(created_at)
    ");
    $stmt3->execute([$year]);
    $customerData = [];
    foreach ($stmt3->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $customerData[(int)$row['period']] = (int)$row['new_customers'];
    }

    $stmtW = $db->prepare("
        SELECT MONTH(created_at) as period, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
        FROM walkin_sales WHERE YEAR(created_at) = ?
        GROUP BY MONTH(created_at)
    ");
    $stmtW->execute([$year]);
    $walkinData = [];
    foreach ($stmtW->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $walkinData[(int)$row['period']] = ['revenue' => (float)$row['revenue'], 'count' => (int)$row['count']];
    }

    $lookup = [];
    foreach ($tokenData as $row) {
        $lookup[(int)$row['period']] = $row;
    }

    $rows = [];
    $grandTotals = ['total_tokens' => 0, 'total_revenue' => 0, 'total_redemptions' => 0, 'new_customers' => 0, 'unique_customers' => 0, 'walkin_revenue' => 0, 'walkin_count' => 0];

    for ($m = 1; $m <= 12; $m++) {
        $d = $lookup[$m] ?? null;
        $memberRev = $d ? (float)$d['total_revenue'] : 0;
        $walkinRev = $walkinData[$m]['revenue'] ?? 0;
        $walkinCnt = $walkinData[$m]['count'] ?? 0;
        $entry = [
            'period' => $m,
            'label' => $monthNames[$m - 1] . ' ' . $year,
            'total_tokens' => $d ? (int)$d['total_tokens'] : 0,
            'total_revenue' => $memberRev + $walkinRev,
            'member_revenue' => $memberRev,
            'walkin_revenue' => $walkinRev,
            'walkin_count' => $walkinCnt,
            'unique_customers' => $d ? (int)$d['unique_customers'] : 0,
            'total_redemptions' => $redeemData[$m] ?? 0,
            'new_customers' => $customerData[$m] ?? 0,
        ];
        $grandTotals['total_tokens'] += $entry['total_tokens'];
        $grandTotals['total_revenue'] += $entry['total_revenue'];
        $grandTotals['total_redemptions'] += $entry['total_redemptions'];
        $grandTotals['new_customers'] += $entry['new_customers'];
        $grandTotals['walkin_revenue'] += $walkinRev;
        $grandTotals['walkin_count'] += $walkinCnt;
        $rows[] = $entry;
    }

    apiResponse(true, [
        'view' => 'month',
        'year' => $year,
        'rows' => $rows,
        'totals' => $grandTotals,
    ]);

} else {
    // ============================================
    // DAILY REPORT
    // ============================================
    $daysInMonth = (int)date('t', mktime(0, 0, 0, $month, 1, $year));
    $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    $stmt = $db->prepare("
        SELECT
            DAY(t.created_at) as period,
            COUNT(t.id) as total_tokens,
            COALESCE(SUM(t.amount), 0) as total_revenue,
            COUNT(DISTINCT t.user_id) as unique_customers,
            COUNT(DISTINCT t.vehicle_id) as unique_vehicles
        FROM tokens t
        WHERE YEAR(t.created_at) = ? AND MONTH(t.created_at) = ?
        GROUP BY DAY(t.created_at)
        ORDER BY period ASC
    ");
    $stmt->execute([$year, $month]);
    $tokenData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt2 = $db->prepare("
        SELECT DAY(redeemed_at) as period, COUNT(id) as total_redemptions
        FROM redemptions
        WHERE YEAR(redeemed_at) = ? AND MONTH(redeemed_at) = ?
        GROUP BY DAY(redeemed_at)
    ");
    $stmt2->execute([$year, $month]);
    $redeemData = [];
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $redeemData[(int)$row['period']] = (int)$row['total_redemptions'];
    }

    $stmtW = $db->prepare("
        SELECT DAY(created_at) as period, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
        FROM walkin_sales
        WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
        GROUP BY DAY(created_at)
    ");
    $stmtW->execute([$year, $month]);
    $walkinData = [];
    foreach ($stmtW->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $walkinData[(int)$row['period']] = ['revenue' => (float)$row['revenue'], 'count' => (int)$row['count']];
    }

    $lookup = [];
    foreach ($tokenData as $row) {
        $lookup[(int)$row['period']] = $row;
    }

    $rows = [];
    $grandTotals = ['total_tokens' => 0, 'total_revenue' => 0, 'total_redemptions' => 0, 'unique_customers' => 0, 'walkin_revenue' => 0, 'walkin_count' => 0];

    for ($dd = 1; $dd <= $daysInMonth; $dd++) {
        $data = $lookup[$dd] ?? null;
        $dateObj = new DateTime("$year-$month-$dd");
        $dayName = $dateObj->format('D');

        $memberRev = $data ? (float)$data['total_revenue'] : 0;
        $walkinRev = $walkinData[$dd]['revenue'] ?? 0;
        $walkinCnt = $walkinData[$dd]['count'] ?? 0;

        $entry = [
            'period' => $dd,
            'label' => $dd . ' ' . $monthNames[$month - 1] . ' (' . $dayName . ')',
            'total_tokens' => $data ? (int)$data['total_tokens'] : 0,
            'total_revenue' => $memberRev + $walkinRev,
            'member_revenue' => $memberRev,
            'walkin_revenue' => $walkinRev,
            'walkin_count' => $walkinCnt,
            'unique_customers' => $data ? (int)$data['unique_customers'] : 0,
            'total_redemptions' => $redeemData[$dd] ?? 0,
        ];
        $grandTotals['total_tokens'] += $entry['total_tokens'];
        $grandTotals['total_revenue'] += $entry['total_revenue'];
        $grandTotals['total_redemptions'] += $entry['total_redemptions'];
        $grandTotals['walkin_revenue'] += $walkinRev;
        $grandTotals['walkin_count'] += $walkinCnt;
        $rows[] = $entry;
    }

    apiResponse(true, [
        'view' => 'day',
        'year' => $year,
        'month' => $month,
        'month_name' => $monthNames[$month - 1],
        'rows' => $rows,
        'totals' => $grandTotals,
    ]);
}
