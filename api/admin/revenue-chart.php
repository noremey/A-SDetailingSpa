<?php
/**
 * Admin Revenue Chart Data
 * GET: Returns monthly revenue for a given year
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

// Validate year range (dynamic: current year to +11)
$currentYear = (int)date('Y');
if ($year < $currentYear || $year > $currentYear + 11) {
    $year = $currentYear;
}

$monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Try transactions table first (only payments that earned tokens)
$stmt = $db->prepare("
    SELECT MONTH(created_at) as month, COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(token_count), 0) as token_count
    FROM transactions
    WHERE YEAR(created_at) = ? AND token_count > 0
    GROUP BY MONTH(created_at)
    ORDER BY month ASC
");
$stmt->execute([$year]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Fallback to tokens table if transactions has no data for this year
if (empty($rows)) {
    $stmt = $db->prepare("
        SELECT MONTH(created_at) as month, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as token_count
        FROM tokens
        WHERE YEAR(created_at) = ? AND amount IS NOT NULL AND amount > 0
        GROUP BY MONTH(created_at)
        ORDER BY month ASC
    ");
    $stmt->execute([$year]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// Build lookup
$monthData = [];
foreach ($rows as $row) {
    $monthData[(int)$row['month']] = [
        'revenue' => (float)$row['revenue'],
        'token_count' => (int)$row['token_count'],
    ];
}

// Walk-in sales monthly data
$stmtW = $db->prepare("
    SELECT MONTH(created_at) as month, COALESCE(SUM(amount), 0) as revenue
    FROM walkin_sales
    WHERE YEAR(created_at) = ?
    GROUP BY MONTH(created_at)
    ORDER BY month ASC
");
$stmtW->execute([$year]);
$walkinRows = $stmtW->fetchAll(PDO::FETCH_ASSOC);
$walkinMonthData = [];
foreach ($walkinRows as $row) {
    $walkinMonthData[(int)$row['month']] = (float)$row['revenue'];
}

// Build full 12-month response
$data = [];
for ($m = 1; $m <= 12; $m++) {
    $memberRevenue = isset($monthData[$m]) ? $monthData[$m]['revenue'] : 0;
    $walkinRevenue = $walkinMonthData[$m] ?? 0;
    $data[] = [
        'month' => $m,
        'name' => $monthNames[$m - 1],
        'revenue' => $memberRevenue + $walkinRevenue,
        'member_revenue' => $memberRevenue,
        'walkin_revenue' => $walkinRevenue,
        'token_count' => isset($monthData[$m]) ? $monthData[$m]['token_count'] : 0,
    ];
}

// Get year total - try transactions first
$stmt2 = $db->prepare("
    SELECT COALESCE(SUM(amount), 0) as total_revenue, COALESCE(SUM(token_count), 0) as total_tokens
    FROM transactions
    WHERE YEAR(created_at) = ? AND token_count > 0
");
$stmt2->execute([$year]);
$totals = $stmt2->fetch(PDO::FETCH_ASSOC);

// Fallback to tokens table if no transaction data
if ((float)$totals['total_revenue'] == 0) {
    $stmt2 = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) as total_revenue, COUNT(*) as total_tokens
        FROM tokens
        WHERE YEAR(created_at) = ? AND amount IS NOT NULL AND amount > 0
    ");
    $stmt2->execute([$year]);
    $totals = $stmt2->fetch(PDO::FETCH_ASSOC);
}

// Walk-in year total
$stmtW2 = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM walkin_sales WHERE YEAR(created_at) = ?");
$stmtW2->execute([$year]);
$walkinYearTotal = (float)$stmtW2->fetchColumn();

apiResponse(true, [
    'year' => $year,
    'data' => $data,
    'total_revenue' => (float)$totals['total_revenue'] + $walkinYearTotal,
    'member_revenue' => (float)$totals['total_revenue'],
    'walkin_revenue' => $walkinYearTotal,
    'total_tokens' => (int)$totals['total_tokens'],
]);
