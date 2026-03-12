<?php
/**
 * Transaction History — Smart DataTable API
 * GET: Returns transactions (loyalty + walk-in) with server-side
 *      pagination, sorting, filtering, and date range support
 *
 * Query params:
 *   page           int     (default 1)
 *   limit          int     (default 25, max 100)
 *   date_from      string  YYYY-MM-DD (default today)
 *   date_to        string  YYYY-MM-DD (default today)
 *   sort_by        string  created_at|amount|type|status (default created_at)
 *   sort_dir       string  ASC|DESC (default DESC)
 *   type           string  loyalty|walkin (default all)
 *   status         string  active|voided (default all)
 *   payment_method string  cash|online|split (default all)
 *   search         string  free-text search on customer/staff/ID
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$admin = requireAdmin();
$db = getDB();

// ── Parse & validate params ──────────────────────────────────
$page      = max(1, (int)($_GET['page'] ?? 1));
$limit     = min(100, max(10, (int)($_GET['limit'] ?? 25)));
$offset    = ($page - 1) * $limit;
$dateFrom  = sanitizeString($_GET['date_from'] ?? date('Y-m-d'));
$dateTo    = sanitizeString($_GET['date_to'] ?? date('Y-m-d'));
$sortBy    = in_array($_GET['sort_by'] ?? '', ['created_at', 'amount', 'type', 'status']) ? $_GET['sort_by'] : 'created_at';
$sortDir   = strtoupper($_GET['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
$filterType   = in_array($_GET['type'] ?? '', ['loyalty', 'walkin']) ? $_GET['type'] : '';
$filterStatus = in_array($_GET['status'] ?? '', ['active', 'voided']) ? $_GET['status'] : '';
$filterPay    = in_array($_GET['payment_method'] ?? '', ['cash', 'online', 'split']) ? $_GET['payment_method'] : '';
$search       = sanitizeString($_GET['search'] ?? '');

// Validate date format
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) $dateFrom = date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo))   $dateTo   = date('Y-m-d');
if ($dateFrom > $dateTo) $dateTo = $dateFrom;

try {
    // ── Build sub-queries ────────────────────────────────────
    $loyaltyParams = [];
    $walkinParams  = [];
    $loyaltySQL    = '';
    $walkinSQL     = '';

    // --- Loyalty sub-query ---
    if ($filterType !== 'walkin') {
        $lWhere = ["DATE(t.created_at) >= :l_from", "DATE(t.created_at) <= :l_to"];
        $loyaltyParams[':l_from'] = $dateFrom;
        $loyaltyParams[':l_to']   = $dateTo;

        if ($filterStatus) {
            $lWhere[] = "t.status = :l_status";
            $loyaltyParams[':l_status'] = $filterStatus;
        }
        if ($filterPay) {
            if ($filterPay === 'cash') {
                $lWhere[] = "(t.payment_method = 'cash' OR t.payment_method IS NULL)";
            } else {
                $lWhere[] = "t.payment_method = :l_pay";
                $loyaltyParams[':l_pay'] = $filterPay;
            }
        }
        if ($search) {
            $lWhere[] = "(u.name LIKE :l_s1 OR u.phone LIKE :l_s2 OR staff.name LIKE :l_s3 OR CAST(t.id AS CHAR) LIKE :l_s4)";
            $loyaltyParams[':l_s1'] = "%$search%";
            $loyaltyParams[':l_s2'] = "%$search%";
            $loyaltyParams[':l_s3'] = "%$search%";
            $loyaltyParams[':l_s4'] = "%$search%";
        }

        $lWhereStr = implode(' AND ', $lWhere);
        $loyaltySQL = "
            SELECT
                t.id,
                'loyalty' as type,
                t.amount,
                t.token_count,
                t.status,
                t.void_reason,
                t.notes,
                COALESCE(t.payment_method, 'cash') as payment_method,
                t.cash_amount,
                t.online_amount,
                t.created_at,
                t.voided_at,
                u.name as customer_name,
                u.phone as customer_phone,
                staff.name as staff_name,
                voider.name as voided_by_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users staff ON t.added_by = staff.id
            LEFT JOIN users voider ON t.voided_by = voider.id
            WHERE $lWhereStr
        ";
    }

    // --- Walk-in sub-query ---
    if ($filterType !== 'loyalty') {
        $wWhere = ["DATE(ws.created_at) >= :w_from", "DATE(ws.created_at) <= :w_to"];
        $walkinParams[':w_from'] = $dateFrom;
        $walkinParams[':w_to']   = $dateTo;

        if ($filterStatus) {
            $wWhere[] = "ws.status = :w_status";
            $walkinParams[':w_status'] = $filterStatus;
        }
        if ($filterPay) {
            if ($filterPay === 'cash') {
                $wWhere[] = "(ws.payment_method = 'cash' OR ws.payment_method IS NULL)";
            } else {
                $wWhere[] = "ws.payment_method = :w_pay";
                $walkinParams[':w_pay'] = $filterPay;
            }
        }
        if ($search) {
            $wWhere[] = "(ws.customer_name LIKE :w_s1 OR staff2.name LIKE :w_s2 OR CAST(ws.id AS CHAR) LIKE :w_s3)";
            $walkinParams[':w_s1'] = "%$search%";
            $walkinParams[':w_s2'] = "%$search%";
            $walkinParams[':w_s3'] = "%$search%";
        }

        $wWhereStr = implode(' AND ', $wWhere);
        $walkinSQL = "
            SELECT
                ws.id,
                'walkin' as type,
                ws.amount,
                0 as token_count,
                ws.status,
                ws.void_reason,
                ws.notes,
                COALESCE(ws.payment_method, 'cash') as payment_method,
                ws.cash_amount,
                ws.online_amount,
                ws.created_at,
                ws.voided_at,
                ws.customer_name,
                NULL as customer_phone,
                staff2.name as staff_name,
                voider2.name as voided_by_name
            FROM walkin_sales ws
            LEFT JOIN users staff2 ON ws.added_by = staff2.id
            LEFT JOIN users voider2 ON ws.voided_by = voider2.id
            WHERE $wWhereStr
        ";
    }

    // ── Combine with UNION ALL ───────────────────────────────
    $allParams = array_merge($loyaltyParams, $walkinParams);

    if ($loyaltySQL && $walkinSQL) {
        $unionSQL = "($loyaltySQL) UNION ALL ($walkinSQL)";
    } elseif ($loyaltySQL) {
        $unionSQL = $loyaltySQL;
    } elseif ($walkinSQL) {
        $unionSQL = $walkinSQL;
    } else {
        // Shouldn't happen, but fallback
        apiResponse(true, [
            'transactions' => [],
            'summary' => ['active_total'=>0,'active_count'=>0,'voided_total'=>0,'voided_count'=>0,'cash_total'=>0,'online_total'=>0,'loyalty_count'=>0,'loyalty_total'=>0,'walkin_count'=>0,'walkin_total'=>0],
            'pagination' => ['page'=>1,'limit'=>$limit,'total'=>0,'total_pages'=>0],
        ]);
    }

    // ── Count total ──────────────────────────────────────────
    $countSQL = "SELECT COUNT(*) as total FROM ($unionSQL) AS combined";
    $stmt = $db->prepare($countSQL);
    $stmt->execute($allParams);
    $total = (int)$stmt->fetchColumn();
    $totalPages = $total > 0 ? (int)ceil($total / $limit) : 0;

    // Clamp page
    if ($page > $totalPages && $totalPages > 0) $page = $totalPages;

    // ── Fetch paginated data ─────────────────────────────────
    // $sortBy and $sortDir are whitelist-validated, safe to interpolate
    $dataSQL = "SELECT * FROM ($unionSQL) AS combined ORDER BY $sortBy $sortDir LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($dataSQL);
    $stmt->execute($allParams);
    $transactions = $stmt->fetchAll();

    // ── Enhanced summary (full filtered dataset, no pagination) ──
    $summarySQL = "
        SELECT
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
            COALESCE(SUM(CASE WHEN status = 'active' THEN amount END), 0) as active_total,
            COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count,
            COALESCE(SUM(CASE WHEN status = 'voided' THEN amount END), 0) as voided_total,
            COALESCE(SUM(CASE WHEN status = 'active' AND (payment_method = 'cash' OR payment_method IS NULL) THEN COALESCE(cash_amount, amount) END), 0) as cash_total,
            COALESCE(SUM(CASE WHEN status = 'active' AND payment_method = 'online' THEN COALESCE(online_amount, amount) END), 0) as online_total,
            COALESCE(SUM(CASE WHEN status = 'active' AND payment_method = 'split' THEN cash_amount END), 0) as split_cash,
            COALESCE(SUM(CASE WHEN status = 'active' AND payment_method = 'split' THEN online_amount END), 0) as split_online,
            COUNT(CASE WHEN type = 'loyalty' AND status = 'active' THEN 1 END) as loyalty_count,
            COALESCE(SUM(CASE WHEN type = 'loyalty' AND status = 'active' THEN amount END), 0) as loyalty_total,
            COUNT(CASE WHEN type = 'walkin' AND status = 'active' THEN 1 END) as walkin_count,
            COALESCE(SUM(CASE WHEN type = 'walkin' AND status = 'active' THEN amount END), 0) as walkin_total
        FROM ($unionSQL) AS combined
    ";
    $stmt = $db->prepare($summarySQL);
    $stmt->execute($allParams);
    $s = $stmt->fetch();

    apiResponse(true, [
        'transactions' => $transactions,
        'summary' => [
            'active_total'  => round((float)$s['active_total'], 2),
            'active_count'  => (int)$s['active_count'],
            'voided_total'  => round((float)$s['voided_total'], 2),
            'voided_count'  => (int)$s['voided_count'],
            'cash_total'    => round((float)$s['cash_total'] + (float)$s['split_cash'], 2),
            'online_total'  => round((float)$s['online_total'] + (float)$s['split_online'], 2),
            'loyalty_count' => (int)$s['loyalty_count'],
            'loyalty_total' => round((float)$s['loyalty_total'], 2),
            'walkin_count'  => (int)$s['walkin_count'],
            'walkin_total'  => round((float)$s['walkin_total'], 2),
        ],
        'pagination' => [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => $totalPages,
        ],
    ]);

} catch (Exception $e) {
    apiResponse(false, null, 'Failed to fetch transactions: ' . $e->getMessage(), 500);
}
