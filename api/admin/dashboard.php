<?php
/**
 * Admin Dashboard Stats
 * GET: Returns all dashboard statistics
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

// Total customers
$stmt = $db->query("SELECT COUNT(*) FROM users WHERE role = 'customer' AND status = 'active'");
$totalCustomers = (int)$stmt->fetchColumn();

// Tokens today
$stmt = $db->query("SELECT COUNT(*) FROM tokens WHERE DATE(created_at) = CURDATE()");
$tokensToday = (int)$stmt->fetchColumn();

// Active cards
$stmt = $db->query("SELECT COUNT(*) FROM loyalty_cards WHERE status = 'active'");
$activeCards = (int)$stmt->fetchColumn();

// Completed cards (awaiting redemption)
$stmt = $db->query("SELECT COUNT(*) FROM loyalty_cards WHERE status = 'completed'");
$completedCards = (int)$stmt->fetchColumn();

// Redeemed today
$stmt = $db->query("SELECT COUNT(*) FROM redemptions WHERE DATE(redeemed_at) = CURDATE()");
$redeemedToday = (int)$stmt->fetchColumn();

// Total redeemed all time
$stmt = $db->query("SELECT COUNT(*) FROM redemptions");
$totalRedeemed = (int)$stmt->fetchColumn();

// Total tokens all time
$stmt = $db->query("SELECT COUNT(*) FROM tokens");
$totalTokens = (int)$stmt->fetchColumn();

// Revenue today - ONLY payments that earned tokens (token_count > 0)
$stmt = $db->query("
    SELECT COALESCE(SUM(amount), 0) FROM transactions
    WHERE DATE(created_at) = CURDATE() AND token_count > 0
");
$revenueTodayTx = (float)$stmt->fetchColumn();

// Fallback to tokens table if transactions table has no data yet (for old records)
if ($revenueTodayTx == 0) {
    $stmt = $db->query("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE DATE(created_at) = CURDATE() AND amount IS NOT NULL");
    $revenueTodayTx = (float)$stmt->fetchColumn();
}
$revenueToday = $revenueTodayTx;

// Below-threshold payments today (recorded but no token)
$stmt = $db->query("
    SELECT COALESCE(SUM(amount), 0) FROM transactions
    WHERE DATE(created_at) = CURDATE() AND token_count = 0
");
$belowThresholdToday = (float)$stmt->fetchColumn();

// Count of below-threshold payments today
$stmt = $db->query("
    SELECT COUNT(*) FROM transactions
    WHERE DATE(created_at) = CURDATE() AND token_count = 0
");
$belowThresholdCount = (int)$stmt->fetchColumn();

// Walk-in sales today
$stmt = $db->query("
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM walkin_sales
    WHERE DATE(created_at) = CURDATE()
");
$walkinToday = $stmt->fetch();
$walkinTodayRevenue = (float)$walkinToday['total'];
$walkinTodayCount = (int)$walkinToday['count'];

// Tokens by day (last 7 days)
$stmt = $db->query("
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM tokens
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
");
$tokensByDay = $stmt->fetchAll();

// New customers this week
$stmt = $db->query("
    SELECT COUNT(*) FROM users
    WHERE role = 'customer' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
");
$newCustomersWeek = (int)$stmt->fetchColumn();

// Recent activity
$stmt = $db->prepare("
    SELECT al.id, al.action, al.description, al.created_at,
           u.name as user_name
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 15
");
$stmt->execute();
$recentActivity = $stmt->fetchAll();

// Top customers (by token count)
$stmt = $db->query("
    SELECT u.id, u.user_code, u.name, u.phone, COUNT(t.id) as total_tokens,
           COUNT(DISTINCT t.card_id) as total_cards
    FROM users u
    JOIN tokens t ON u.id = t.user_id
    WHERE u.role = 'customer'
    GROUP BY u.id, u.user_code, u.name, u.phone
    ORDER BY total_tokens DESC
    LIMIT 5
");
$topCustomers = $stmt->fetchAll();

apiResponse(true, [
    'stats' => [
        'total_customers'    => $totalCustomers,
        'tokens_today'       => $tokensToday,
        'active_cards'       => $activeCards,
        'completed_cards'    => $completedCards,
        'redeemed_today'     => $redeemedToday,
        'total_redeemed'     => $totalRedeemed,
        'total_tokens'       => $totalTokens,
        'revenue_today'           => $revenueToday,
        'below_threshold_today'   => $belowThresholdToday,
        'below_threshold_count'   => $belowThresholdCount,
        'walkin_today'            => $walkinTodayRevenue,
        'walkin_count_today'      => $walkinTodayCount,
        'new_customers_week'      => $newCustomersWeek,
    ],
    'tokens_by_day'    => $tokensByDay,
    'recent_activity'  => $recentActivity,
    'top_customers'    => $topCustomers,
]);
