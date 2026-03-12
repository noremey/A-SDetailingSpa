<?php
/**
 * Admin Activity Log
 * GET: Returns paginated activity log entries
 * Supports: search (q), action type filter (type), pagination (page, limit=10)
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

$page   = max(1, (int)($_GET['page'] ?? 1));
$limit  = min(50, max(5, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;
$q      = sanitizeString($_GET['q'] ?? '');
$type   = sanitizeString($_GET['type'] ?? '');

// Build WHERE conditions
$where = [];
$params = [];

if ($q !== '') {
    $searchTerm = "%$q%";
    $where[] = "(al.description LIKE ? OR al.action LIKE ? OR u.name LIKE ? OR u.user_code LIKE ?)";
    $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
}

if ($type !== '') {
    $where[] = "al.action LIKE ?";
    $params[] = "%$type%";
}

$whereSQL = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Total count
$stmt = $db->prepare("SELECT COUNT(*) FROM activity_log al LEFT JOIN users u ON al.user_id = u.id $whereSQL");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Get paginated activity
$stmt = $db->prepare("
    SELECT al.id, al.user_id, al.action, al.description, al.ip_address, al.created_at,
           u.name as user_name, u.user_code, u.role as user_role
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.id
    $whereSQL
    ORDER BY al.created_at DESC
    LIMIT $limit OFFSET $offset
");
$stmt->execute($params);
$activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Type cast
foreach ($activities as &$a) {
    $a['id'] = (int)$a['id'];
    $a['user_id'] = $a['user_id'] ? (int)$a['user_id'] : null;
}

// Get distinct action types for filter
$stmtTypes = $db->query("
    SELECT DISTINCT
        CASE
            WHEN action LIKE '%token%' THEN 'token'
            WHEN action LIKE '%redeem%' THEN 'redeem'
            WHEN action LIKE '%register%' THEN 'register'
            WHEN action LIKE '%login%' THEN 'login'
            WHEN action LIKE '%card%' THEN 'card'
            WHEN action LIKE '%setting%' THEN 'setting'
            WHEN action LIKE '%vehicle%' THEN 'vehicle'
            ELSE 'system'
        END as type
    FROM activity_log
    ORDER BY type
");
$actionTypes = $stmtTypes->fetchAll(PDO::FETCH_COLUMN);

apiResponse(true, [
    'activities'   => $activities,
    'action_types' => array_values(array_unique($actionTypes)),
    'pagination'   => [
        'page'        => $page,
        'limit'       => $limit,
        'total'       => $total,
        'total_pages' => (int)ceil($total / $limit),
    ],
]);
