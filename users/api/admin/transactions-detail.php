<?php
/**
 * Admin Transactions Detail API
 * GET: Returns individual transaction details for a specific period
 *
 * Params:
 *   view: 'day' | 'month' | 'year'
 *   year: YYYY
 *   month: 1-12 (for day/month view)
 *   day: 1-31 (for day view)
 */
require_once __DIR__ . '/../staff-config.php';

$admin = requireAdmin();
$db = getDB();

$view = isset($_GET['view']) ? sanitizeString($_GET['view']) : 'day';
$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
$day = isset($_GET['day']) ? (int)$_GET['day'] : (int)date('d');

// Validate
$currentYear = (int)date('Y');
if ($year < $currentYear || $year > $currentYear + 11) $year = $currentYear;
if ($month < 1 || $month > 12) $month = (int)date('m');
$daysInMonth = (int)date('t', mktime(0, 0, 0, $month, 1, $year));
if ($day < 1 || $day > $daysInMonth) $day = (int)date('d');

// Build WHERE conditions based on view
if ($view === 'day') {
    $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $day);
    $tokenWhere = "DATE(t.created_at) = ?";
    $tokenParams = [$dateStr];
    $walkinWhere = "DATE(w.created_at) = ?";
    $walkinParams = [$dateStr];
    $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    $periodLabel = "$day " . $monthNames[$month - 1] . " $year";
} elseif ($view === 'month') {
    $tokenWhere = "YEAR(t.created_at) = ? AND MONTH(t.created_at) = ?";
    $tokenParams = [$year, $month];
    $walkinWhere = "YEAR(w.created_at) = ? AND MONTH(w.created_at) = ?";
    $walkinParams = [$year, $month];
    $periodLabel = date('F', mktime(0, 0, 0, $month, 1)) . " $year";
} else {
    $tokenWhere = "YEAR(t.created_at) = ?";
    $tokenParams = [$year];
    $walkinWhere = "YEAR(w.created_at) = ?";
    $walkinParams = [$year];
    $periodLabel = (string)$year;
}

// Loyalty card payments (from tokens table)
$stmt = $db->prepare("
    SELECT
        t.id,
        t.amount,
        t.created_at,
        COALESCE(u.name, 'Member') as customer_name,
        COALESCE(u.phone, '') as customer_phone,
        COALESCE(staff.name, '-') as staff_name,
        'loyalty' as type
    FROM tokens t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN users staff ON t.added_by = staff.id
    WHERE $tokenWhere
    ORDER BY t.created_at DESC
");
$stmt->execute($tokenParams);
$loyaltyTx = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Walk-in sales
$stmt2 = $db->prepare("
    SELECT
        w.id,
        w.amount,
        w.created_at,
        COALESCE(NULLIF(w.customer_name, ''), 'Walk-in') as customer_name,
        '' as customer_phone,
        COALESCE(staff.name, '-') as staff_name,
        'walkin' as type
    FROM walkin_sales w
    LEFT JOIN users staff ON w.added_by = staff.id
    WHERE $walkinWhere
    ORDER BY w.created_at DESC
");
$stmt2->execute($walkinParams);
$walkinTx = $stmt2->fetchAll(PDO::FETCH_ASSOC);

// Merge and sort by created_at DESC
$allTransactions = array_merge($loyaltyTx, $walkinTx);
usort($allTransactions, function($a, $b) {
    return strtotime($b['created_at']) - strtotime($a['created_at']);
});

// Format amounts as float
foreach ($allTransactions as &$tx) {
    $tx['amount'] = (float)$tx['amount'];
}
unset($tx);

// Summary
$totalRevenue = array_sum(array_column($allTransactions, 'amount'));
$loyaltyRevenue = 0;
$walkinRevenue = 0;
foreach ($loyaltyTx as $tx) $loyaltyRevenue += (float)$tx['amount'];
foreach ($walkinTx as $tx) $walkinRevenue += (float)$tx['amount'];

apiResponse(true, [
    'period_label' => $periodLabel,
    'view' => $view,
    'transactions' => $allTransactions,
    'summary' => [
        'total_count' => count($allTransactions),
        'total_revenue' => $totalRevenue,
        'loyalty_count' => count($loyaltyTx),
        'loyalty_revenue' => $loyaltyRevenue,
        'walkin_count' => count($walkinTx),
        'walkin_revenue' => $walkinRevenue,
    ],
]);
