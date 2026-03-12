<?php
/**
 * Admin Broadcast Notifications (Push Only)
 * GET  ?action=list   — List broadcast history (paginated)
 * GET  ?action=stats  — Summary stats
 * POST action=send    — Send push broadcast to all customers
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'list');

    if ($action === 'list') {
        $page  = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;

        $stmt = $db->prepare("SELECT COUNT(*) FROM broadcasts");
        $stmt->execute();
        $total = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("
            SELECT b.*, u.name AS sent_by_name
            FROM broadcasts b
            LEFT JOIN users u ON u.id = b.sent_by
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$limit, $offset]);
        $broadcasts = $stmt->fetchAll();

        apiResponse(true, [
            'broadcasts' => $broadcasts,
            'total'      => $total,
            'page'       => $page,
            'pages'      => ceil($total / $limit),
        ]);

    } elseif ($action === 'stats') {
        $stmt = $db->query("
            SELECT
                COUNT(*) as total_broadcasts,
                SUM(push_sent) as total_push_sent,
                SUM(total_recipients) as total_recipients
            FROM broadcasts WHERE status = 'completed'
        ");
        $stats = $stmt->fetch();
        apiResponse(true, ['stats' => $stats]);
    }

} elseif ($method === 'POST') {
    $input  = getInput();
    $action = sanitizeString($input['action'] ?? '');

    if ($action === 'delete') {
        $broadcastId = sanitizeInt($input['broadcast_id'] ?? 0);
        if (!$broadcastId) {
            apiResponse(false, null, 'ID tidak sah');
        }

        $stmt = $db->prepare("DELETE FROM broadcasts WHERE id = ?");
        $stmt->execute([$broadcastId]);

        if ($stmt->rowCount() === 0) {
            apiResponse(false, null, 'Broadcast tidak dijumpai');
        }

        logActivity($admin['user_id'], 'broadcast_deleted', 'broadcast', $broadcastId, "Deleted broadcast #$broadcastId");

        apiResponse(true, null, 'Broadcast berjaya dipadam');

    } elseif ($action === 'send') {
        $title   = sanitizeString($input['title'] ?? '');
        $message = sanitizeString($input['message'] ?? '');

        $customerIds = $input['customer_ids'] ?? null; // array of IDs or null for all

        if (!$title || !$message) {
            apiResponse(false, null, 'Sila masukkan tajuk dan mesej');
        }

        // Get customers — selected or all active
        if (is_array($customerIds) && !empty($customerIds)) {
            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
            $stmt = $db->prepare("
                SELECT id, name, phone
                FROM users
                WHERE id IN ($placeholders) AND role = 'customer' AND status = 'active'
            ");
            $stmt->execute(array_map('intval', $customerIds));
        } else {
            $stmt = $db->prepare("
                SELECT id, name, phone
                FROM users
                WHERE role = 'customer' AND status = 'active'
            ");
            $stmt->execute();
        }
        $customers = $stmt->fetchAll();

        if (empty($customers)) {
            apiResponse(false, null, 'Tiada pelanggan aktif');
        }

        // Create broadcast record
        $stmt = $db->prepare("
            INSERT INTO broadcasts (title, message, channels, sent_by, total_recipients, status)
            VALUES (?, ?, 'push', ?, ?, 'sending')
        ");
        $stmt->execute([$title, $message, $admin['user_id'], count($customers)]);
        $broadcastId = (int)$db->lastInsertId();

        // Send push notifications
        $pushSent = 0;
        $pushFailed = 0;

        try {
            if (file_exists(__DIR__ . '/../helpers/send-push.php')) {
                require_once __DIR__ . '/../helpers/send-push.php';
                if (function_exists('notifyUser')) {
                    foreach ($customers as $customer) {
                        try {
                            notifyUser((int)$customer['id'], $title, $message, '/users/');
                            $pushSent++;
                        } catch (\Throwable $e) {
                            $pushFailed++;
                        }
                    }
                } else {
                    $pushFailed = count($customers);
                }
            } else {
                $pushFailed = count($customers);
            }
        } catch (\Throwable $e) {
            $pushFailed = count($customers);
        }

        // Update broadcast record
        $stmt = $db->prepare("
            UPDATE broadcasts
            SET push_sent = ?, push_failed = ?, status = 'completed'
            WHERE id = ?
        ");
        $stmt->execute([$pushSent, $pushFailed, $broadcastId]);

        logActivity($admin['user_id'], 'broadcast_sent', 'broadcast', $broadcastId,
            "Broadcast \"{$title}\" sent to " . count($customers) . " customers",
            ['channels' => 'push', 'push_sent' => $pushSent]
        );

        apiResponse(true, [
            'broadcast_id'     => $broadcastId,
            'total_recipients' => count($customers),
            'push_sent'        => $pushSent,
            'push_failed'      => $pushFailed,
        ], 'Broadcast berjaya dihantar!');
    }
}
