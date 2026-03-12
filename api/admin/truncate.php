<?php
/**
 * Admin Truncate / Reset Data (super_admin only)
 *
 * GET  action=preview  → Show row counts for all tables
 * POST action=truncate_customers → Remove all customer data (users with role=customer + related data)
 * POST action=truncate_transactions → Remove all transactions, tokens, walkin_sales
 * POST action=truncate_all → Full reset: customers + transactions + redemptions + activity
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

// Super admin only
if ($admin['role'] !== 'super_admin') {
    apiResponse(false, null, 'Only Super Admin can perform data truncation', 403);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'preview');

    if ($action === 'preview') {
        // Get row counts for all tables
        $tables = [
            'users_customer' => "SELECT COUNT(*) FROM users WHERE role = 'customer'",
            'users_staff'    => "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'staff', 'super_admin')",
            'vehicles'       => "SELECT COUNT(*) FROM vehicles",
            'loyalty_cards'  => "SELECT COUNT(*) FROM loyalty_cards",
            'tokens'         => "SELECT COUNT(*) FROM tokens",
            'transactions'   => "SELECT COUNT(*) FROM transactions",
            'walkin_sales'   => "SELECT COUNT(*) FROM walkin_sales",
            'redemptions'    => "SELECT COUNT(*) FROM redemptions",
            'activity_log'   => "SELECT COUNT(*) FROM activity_log",
            'staff_invites'  => "SELECT COUNT(*) FROM staff_invites",
        ];

        $counts = [];
        foreach ($tables as $key => $sql) {
            try {
                $stmt = $db->query($sql);
                $counts[$key] = (int) $stmt->fetchColumn();
            } catch (Exception $e) {
                $counts[$key] = 0;
            }
        }

        // Group summary
        $summary = [
            'total_customers'    => $counts['users_customer'],
            'total_staff'        => $counts['users_staff'],
            'total_vehicles'     => $counts['vehicles'],
            'total_loyalty_cards'=> $counts['loyalty_cards'],
            'total_tokens'       => $counts['tokens'],
            'total_transactions' => $counts['transactions'],
            'total_walkin_sales' => $counts['walkin_sales'],
            'total_redemptions'  => $counts['redemptions'],
            'total_activity_log' => $counts['activity_log'],
            'total_staff_invites'=> $counts['staff_invites'],
        ];

        // What each truncate action will delete
        $actions = [
            'truncate_customers' => [
                'label'       => 'Truncate Customers',
                'description' => 'Delete all customers and their related data (vehicles, loyalty cards, tokens, transactions, redemptions). Staff/admin accounts are preserved.',
                'affected'    => [
                    ['table' => 'users (customers)', 'rows' => $counts['users_customer']],
                    ['table' => 'vehicles', 'rows' => $counts['vehicles']],
                    ['table' => 'loyalty_cards', 'rows' => $counts['loyalty_cards']],
                    ['table' => 'tokens', 'rows' => $counts['tokens']],
                    ['table' => 'transactions', 'rows' => $counts['transactions']],
                    ['table' => 'redemptions', 'rows' => $counts['redemptions']],
                ],
                'preserved' => ['Staff/admin accounts', 'Walk-in sales', 'Settings', 'Services'],
            ],
            'truncate_transactions' => [
                'label'       => 'Truncate Transactions',
                'description' => 'Delete all transaction records (loyalty transactions, tokens, walk-in sales, redemptions). Customer accounts are preserved but loyalty cards will be reset.',
                'affected'    => [
                    ['table' => 'tokens', 'rows' => $counts['tokens']],
                    ['table' => 'transactions', 'rows' => $counts['transactions']],
                    ['table' => 'walkin_sales', 'rows' => $counts['walkin_sales']],
                    ['table' => 'redemptions', 'rows' => $counts['redemptions']],
                    ['table' => 'loyalty_cards', 'rows' => $counts['loyalty_cards']],
                ],
                'preserved' => ['Customer accounts', 'Vehicles', 'Staff accounts', 'Settings'],
            ],
            'truncate_all' => [
                'label'       => 'Truncate All Data',
                'description' => 'FULL RESET — Delete everything except staff/admin accounts and settings. This is a complete data wipe.',
                'affected'    => [
                    ['table' => 'users (customers)', 'rows' => $counts['users_customer']],
                    ['table' => 'vehicles', 'rows' => $counts['vehicles']],
                    ['table' => 'loyalty_cards', 'rows' => $counts['loyalty_cards']],
                    ['table' => 'tokens', 'rows' => $counts['tokens']],
                    ['table' => 'transactions', 'rows' => $counts['transactions']],
                    ['table' => 'walkin_sales', 'rows' => $counts['walkin_sales']],
                    ['table' => 'redemptions', 'rows' => $counts['redemptions']],
                    ['table' => 'activity_log', 'rows' => $counts['activity_log']],
                    ['table' => 'staff_invites', 'rows' => $counts['staff_invites']],
                ],
                'preserved' => ['Staff/admin accounts', 'Settings', 'Services'],
            ],
        ];

        apiResponse(true, [
            'summary' => $summary,
            'actions' => $actions,
        ]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = sanitizeString($input['action'] ?? '');
    $confirmCode = sanitizeString($input['confirm_code'] ?? '');

    // Require confirmation code: "TRUNCATE"
    if ($confirmCode !== 'TRUNCATE') {
        apiResponse(false, null, 'Confirmation code required. Type TRUNCATE to confirm.');
    }

    try {
        // NOTE: TRUNCATE causes implicit commit in MySQL, so we cannot use transactions.
        // Instead, we disable FK checks, run all operations, then re-enable FK checks.
        $db->exec("SET FOREIGN_KEY_CHECKS = 0");

        $deleted = [];

        switch ($action) {
            case 'truncate_customers':
                // 1. Delete redemptions (FK: card_id, user_id)
                $stmt = $db->query("SELECT COUNT(*) FROM redemptions");
                $deleted['redemptions'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE redemptions");

                // 2. Delete tokens (FK: card_id, user_id, vehicle_id)
                $stmt = $db->query("SELECT COUNT(*) FROM tokens");
                $deleted['tokens'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE tokens");

                // 3. Delete transactions (FK: user_id, vehicle_id, card_id)
                $stmt = $db->query("SELECT COUNT(*) FROM transactions");
                $deleted['transactions'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE transactions");

                // 4. Delete loyalty_cards (FK: user_id)
                $stmt = $db->query("SELECT COUNT(*) FROM loyalty_cards");
                $deleted['loyalty_cards'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE loyalty_cards");

                // 5. Delete vehicles (FK: user_id)
                $stmt = $db->query("SELECT COUNT(*) FROM vehicles");
                $deleted['vehicles'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE vehicles");

                // 6. Delete customer users only (keep staff/admin)
                $stmt = $db->query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
                $deleted['users_customer'] = (int) $stmt->fetchColumn();
                $db->exec("DELETE FROM users WHERE role = 'customer'");

                // 7. Reset user_code_sequence for customers
                $db->exec("UPDATE user_code_sequence SET last_number = 0 WHERE id = 1");
                $deleted['user_code_sequence'] = 'reset to 0';

                break;

            case 'truncate_transactions':
                // 1. Delete redemptions
                $stmt = $db->query("SELECT COUNT(*) FROM redemptions");
                $deleted['redemptions'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE redemptions");

                // 2. Delete tokens
                $stmt = $db->query("SELECT COUNT(*) FROM tokens");
                $deleted['tokens'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE tokens");

                // 3. Delete transactions
                $stmt = $db->query("SELECT COUNT(*) FROM transactions");
                $deleted['transactions'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE transactions");

                // 4. Delete walkin_sales
                $stmt = $db->query("SELECT COUNT(*) FROM walkin_sales");
                $deleted['walkin_sales'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE walkin_sales");

                // 5. Delete loyalty_cards (because tokens are gone, cards are meaningless)
                $stmt = $db->query("SELECT COUNT(*) FROM loyalty_cards");
                $deleted['loyalty_cards'] = (int) $stmt->fetchColumn();
                $db->exec("TRUNCATE TABLE loyalty_cards");

                break;

            case 'truncate_all':
                // Delete everything except staff users and settings
                $tables = ['redemptions', 'tokens', 'transactions', 'walkin_sales', 'loyalty_cards', 'vehicles', 'activity_log', 'staff_invites'];

                foreach ($tables as $table) {
                    $stmt = $db->query("SELECT COUNT(*) FROM $table");
                    $deleted[$table] = (int) $stmt->fetchColumn();
                    $db->exec("TRUNCATE TABLE $table");
                }

                // Delete customer users only
                $stmt = $db->query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
                $deleted['users_customer'] = (int) $stmt->fetchColumn();
                $db->exec("DELETE FROM users WHERE role = 'customer'");

                // Reset user_code_sequence
                $db->exec("UPDATE user_code_sequence SET last_number = 0 WHERE id = 1");
                $deleted['user_code_sequence'] = 'reset to 0';

                break;

            default:
                $db->exec("SET FOREIGN_KEY_CHECKS = 1");
                apiResponse(false, null, 'Invalid action. Use: truncate_customers, truncate_transactions, truncate_all');
        }

        // Re-enable FK checks
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");

        // Log the truncation
        logActivity(
            $admin['user_id'],
            'data_truncated',
            'system',
            0,
            "Super Admin truncated data: $action",
            ['action' => $action, 'deleted' => $deleted]
        );

        apiResponse(true, [
            'action'  => $action,
            'deleted' => $deleted,
        ], "Data truncated successfully ($action)");

    } catch (Exception $e) {
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");
        apiResponse(false, null, 'Truncation failed: ' . $e->getMessage(), 500);
    }

} else {
    apiResponse(false, null, 'Method not allowed', 405);
}
