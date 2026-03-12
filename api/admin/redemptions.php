<?php
/**
 * Admin Redemption Management
 * POST action=redeem: Redeem a completed card's free reward
 * GET action=list: List all redemptions (with search, filter by month/year)
 * GET action=pending: List cards awaiting redemption
 * GET action=stats: Redemption stats summary
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = getInput();
    $action = sanitizeString($input['action'] ?? 'redeem');

    if ($action === 'redeem') {
        $cardId = sanitizeInt($input['card_id'] ?? 0);
        $notes  = sanitizeString($input['notes'] ?? '');

        if ($cardId <= 0) {
            apiResponse(false, null, 'Card ID is required');
        }

        $db->beginTransaction();
        try {
            // Get the completed card
            $stmt = $db->prepare("
                SELECT lc.id, lc.user_id, lc.card_number, lc.tokens_required, lc.tokens_earned, lc.status,
                       u.name as customer_name, u.user_code
                FROM loyalty_cards lc
                JOIN users u ON lc.user_id = u.id
                WHERE lc.id = ?
                FOR UPDATE
            ");
            $stmt->execute([$cardId]);
            $card = $stmt->fetch();

            if (!$card) {
                $db->rollBack();
                apiResponse(false, null, 'Card not found', 404);
            }

            if ($card['status'] !== 'completed') {
                $db->rollBack();
                apiResponse(false, null, 'Card is not ready for redemption. Status: ' . $card['status']);
            }

            $rewardDescription = getSetting('reward_description') ?: '1 FREE service/product';

            // Create redemption record
            $stmt = $db->prepare("
                INSERT INTO redemptions (card_id, user_id, processed_by, reward_description, notes)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $cardId,
                $card['user_id'],
                $admin['user_id'],
                $rewardDescription,
                $notes ?: null
            ]);

            // Update card status
            $stmt = $db->prepare("
                UPDATE loyalty_cards SET status = 'redeemed', redeemed_at = NOW() WHERE id = ?
            ");
            $stmt->execute([$cardId]);

            // Auto-create new active card ONLY if no active card exists
            $stmt = $db->prepare("SELECT id, card_number, tokens_required, tokens_earned FROM loyalty_cards WHERE user_id = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$card['user_id']]);
            $existingActive = $stmt->fetch();

            if ($existingActive) {
                // Active card already exists, use it
                $newCardId = (int)$existingActive['id'];
                $nextCardNum = (int)$existingActive['card_number'];
                $tokensPerCard = (int)$existingActive['tokens_required'];
            } else {
                // No active card, create new one
                $tokensPerCard = (int)(getSetting('tokens_per_card') ?: 10);
                $stmt = $db->prepare("SELECT COALESCE(MAX(card_number), 0) FROM loyalty_cards WHERE user_id = ?");
                $stmt->execute([$card['user_id']]);
                $nextCardNum = (int)$stmt->fetchColumn() + 1;

                $stmt = $db->prepare("
                    INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status)
                    VALUES (?, ?, ?, 0, 'active')
                ");
                $stmt->execute([$card['user_id'], $nextCardNum, $tokensPerCard]);
                $newCardId = (int)$db->lastInsertId();
            }

            logActivity($admin['user_id'], 'reward_redeemed', 'redemption', $cardId,
                "Free reward redeemed for {$card['customer_name']} (Card #{$card['card_number']})",
                ['customer_id' => $card['user_id'], 'reward' => $rewardDescription]
            );

            $db->commit();

            // Build success response
            $responseData = [
                'redeemed_card' => [
                    'id'          => (int)$card['id'],
                    'card_number' => (int)$card['card_number'],
                    'status'      => 'redeemed'
                ],
                'new_card' => [
                    'id'              => $newCardId,
                    'card_number'     => $nextCardNum,
                    'tokens_required' => $tokensPerCard,
                    'tokens_earned'   => $existingActive ? (int)$existingActive['tokens_earned'] : 0,
                    'status'          => 'active'
                ],
                'customer' => [
                    'name'      => $card['customer_name'],
                    'user_code' => $card['user_code']
                ],
                'reward' => $rewardDescription
            ];
            $msg = "Free reward redeemed for {$card['customer_name']}! New card #{$nextCardNum} started.";

            // Flush response to client FIRST, then send notification
            http_response_code(200);
            header('Content-Type: application/json');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            $json = json_encode(array_merge(['success' => true, 'message' => $msg], $responseData), JSON_UNESCAPED_UNICODE);
            header('Content-Length: ' . strlen($json));
            echo $json;
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                ob_end_flush();
                flush();
            }

            // Send push notification AFTER response sent (best-effort)
            try {
                if (file_exists(__DIR__ . '/../helpers/notify.php')) {
                    require_once __DIR__ . '/../helpers/notify.php';
                    if (function_exists('notifyUserAll')) {
                        notifyUserAll((int)$card['user_id'],
                            'Ganjaran Ditebus! 🎉',
                            "Tahniah! Ganjaran anda ($rewardDescription) telah ditebus. Kad baru telah dimulakan. Terima kasih kerana setia bersama kami!",
                            '/users/');
                    }
                }
            } catch (\Throwable $e) { /* silent */ }
            exit;

        } catch (\Throwable $e) {
            $db->rollBack();
            apiResponse(false, null, 'Failed to process redemption: ' . $e->getMessage(), 500);
        }
    }

} elseif ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'list');

    if ($action === 'pending') {
        // Cards awaiting redemption - with vehicle plate + total spend on card
        $stmt = $db->prepare("
            SELECT lc.id as card_id, lc.card_number, lc.tokens_earned, lc.tokens_required,
                   lc.completed_at,
                   u.id as customer_id, u.user_code, u.name as customer_name, u.phone,
                   (SELECT v.plate_number FROM vehicles v WHERE v.user_id = u.id AND v.status = 'active' ORDER BY v.is_primary DESC LIMIT 1) as plate_number,
                   (SELECT COALESCE(SUM(t.amount), 0) FROM tokens t WHERE t.card_id = lc.id AND t.amount IS NOT NULL) as card_total_spend,
                   (SELECT COUNT(*) FROM loyalty_cards lc2 WHERE lc2.user_id = u.id AND lc2.status IN ('completed','redeemed')) as completed_cards
            FROM loyalty_cards lc
            JOIN users u ON lc.user_id = u.id
            WHERE lc.status = 'completed'
            ORDER BY lc.completed_at ASC
        ");
        $stmt->execute();
        $pending = $stmt->fetchAll();

        foreach ($pending as &$p) {
            $p['card_id'] = (int)$p['card_id'];
            $p['customer_id'] = (int)$p['customer_id'];
            $p['tokens_earned'] = (int)$p['tokens_earned'];
            $p['tokens_required'] = (int)$p['tokens_required'];
            $p['card_total_spend'] = (float)$p['card_total_spend'];
            $p['completed_cards'] = (int)$p['completed_cards'];
        }

        apiResponse(true, ['pending' => $pending, 'count' => count($pending)]);

    } elseif ($action === 'stats') {
        // Redemption stats
        $stats = [];

        // Total all time
        $stmt = $db->query("SELECT COUNT(*) FROM redemptions");
        $stats['total_all_time'] = (int)$stmt->fetchColumn();

        // This month
        $stmt = $db->query("SELECT COUNT(*) FROM redemptions WHERE YEAR(redeemed_at) = YEAR(CURDATE()) AND MONTH(redeemed_at) = MONTH(CURDATE())");
        $stats['this_month'] = (int)$stmt->fetchColumn();

        // Today
        $stmt = $db->query("SELECT COUNT(*) FROM redemptions WHERE DATE(redeemed_at) = CURDATE()");
        $stats['today'] = (int)$stmt->fetchColumn();

        // Pending
        $stmt = $db->query("SELECT COUNT(*) FROM loyalty_cards WHERE status = 'completed'");
        $stats['pending'] = (int)$stmt->fetchColumn();

        // Top redeemer (most redeemed cards)
        $stmt = $db->query("
            SELECT u.name, u.user_code, COUNT(r.id) as redeem_count
            FROM redemptions r
            JOIN users u ON r.user_id = u.id
            GROUP BY u.id, u.name, u.user_code
            ORDER BY redeem_count DESC
            LIMIT 3
        ");
        $stats['top_redeemers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Monthly trend (last 6 months)
        $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        $stmt = $db->query("
            SELECT YEAR(redeemed_at) as yr, MONTH(redeemed_at) as mo, COUNT(*) as cnt
            FROM redemptions
            WHERE redeemed_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY yr, mo
            ORDER BY yr ASC, mo ASC
        ");
        $trend = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $trend[] = [
                'label' => $monthNames[(int)$row['mo'] - 1] . ' ' . $row['yr'],
                'count' => (int)$row['cnt'],
            ];
        }
        $stats['monthly_trend'] = $trend;

        // Average days to complete a card (from card creation to completion)
        $stmt = $db->query("
            SELECT AVG(DATEDIFF(completed_at, created_at)) as avg_days
            FROM loyalty_cards
            WHERE status IN ('completed', 'redeemed') AND completed_at IS NOT NULL
        ");
        $stats['avg_days_to_complete'] = round((float)$stmt->fetchColumn(), 1);

        apiResponse(true, ['stats' => $stats]);

    } elseif ($action === 'list') {
        $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit  = min(50, max(5, sanitizeInt($_GET['limit'] ?? 10)));
        $offset = ($page - 1) * $limit;
        $search = sanitizeString($_GET['q'] ?? '');
        $filterYear = isset($_GET['year']) ? (int)$_GET['year'] : 0;
        $filterMonth = isset($_GET['month']) ? (int)$_GET['month'] : 0;

        $where = "1=1";
        $params = [];

        if ($search) {
            $searchTerm = "%$search%";
            $where .= " AND (u.name LIKE ? OR u.user_code LIKE ? OR u.phone LIKE ?)";
            $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm]);
        }

        if ($filterYear > 0) {
            $where .= " AND YEAR(r.redeemed_at) = ?";
            $params[] = $filterYear;
        }

        if ($filterMonth > 0 && $filterMonth <= 12) {
            $where .= " AND MONTH(r.redeemed_at) = ?";
            $params[] = $filterMonth;
        }

        // Count
        $stmtCount = $db->prepare("
            SELECT COUNT(*) FROM redemptions r
            JOIN users u ON r.user_id = u.id
            WHERE $where
        ");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        // Fetch with extra info
        $stmt = $db->prepare("
            SELECT r.id, r.card_id, r.user_id, r.reward_description, r.notes, r.redeemed_at,
                   u.name as customer_name, u.user_code, u.phone,
                   a.name as processed_by_name,
                   lc.card_number, lc.tokens_required,
                   (SELECT v.plate_number FROM vehicles v WHERE v.user_id = u.id AND v.status = 'active' ORDER BY v.is_primary DESC LIMIT 1) as plate_number,
                   (SELECT COALESCE(SUM(t.amount), 0) FROM tokens t WHERE t.card_id = r.card_id AND t.amount IS NOT NULL) as card_total_spend
            FROM redemptions r
            JOIN users u ON r.user_id = u.id
            JOIN users a ON r.processed_by = a.id
            JOIN loyalty_cards lc ON r.card_id = lc.id
            WHERE $where
            ORDER BY r.redeemed_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $redemptions = $stmt->fetchAll();

        foreach ($redemptions as &$row) {
            $row['id'] = (int)$row['id'];
            $row['card_total_spend'] = (float)$row['card_total_spend'];
            $row['tokens_required'] = (int)$row['tokens_required'];
        }

        apiResponse(true, [
            'redemptions' => $redemptions,
            'total'       => $total,
            'page'        => $page,
            'pages'       => ceil($total / $limit)
        ]);
    }
}
