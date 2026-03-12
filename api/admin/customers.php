<?php
/**
 * Admin Customer Management
 * GET action=search: Search customers by name/phone/code/plate_number
 * GET action=list: List all customers with pagination
 * GET action=detail: Get full customer details including vehicles
 * POST action=delete: Delete a customer (super_admin only)
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

// Handle POST requests (delete)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = sanitizeString($input['action'] ?? '');

    switch ($action) {
        case 'update':
            // Both admin and super_admin can edit customers
            $customerId = sanitizeInt($input['customer_id'] ?? 0);
            if ($customerId <= 0) {
                apiResponse(false, null, 'Customer ID is required');
            }

            // Verify customer exists
            $stmt = $db->prepare("SELECT id, name, user_code FROM users WHERE id = ? AND role = 'customer'");
            $stmt->execute([$customerId]);
            $customer = $stmt->fetch();
            if (!$customer) {
                apiResponse(false, null, 'Customer not found', 404);
            }

            $allowedFields = ['name', 'phone', 'email'];
            $updates = [];
            $params = [];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $value = trim((string)$input[$field]);
                    // Validate name is not empty
                    if ($field === 'name' && $value === '') {
                        apiResponse(false, null, 'Customer name cannot be empty');
                    }
                    // Validate phone format (if provided)
                    if ($field === 'phone' && $value !== '') {
                        $value = preg_replace('/[^0-9+\-\s]/', '', $value);
                    }
                    // Validate email format (if provided)
                    if ($field === 'email' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                        apiResponse(false, null, 'Invalid email format');
                    }
                    // Check phone uniqueness (if changed)
                    if ($field === 'phone' && $value !== '') {
                        $stmtCheck = $db->prepare("SELECT id FROM users WHERE phone = ? AND id != ?");
                        $stmtCheck->execute([$value, $customerId]);
                        if ($stmtCheck->fetch()) {
                            apiResponse(false, null, 'Phone number already in use by another user');
                        }
                    }
                    // Check email uniqueness (if changed)
                    if ($field === 'email' && $value !== '') {
                        $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
                        $stmtCheck->execute([$value, $customerId]);
                        if ($stmtCheck->fetch()) {
                            apiResponse(false, null, 'Email already in use by another user');
                        }
                    }
                    $updates[] = "$field = ?";
                    $params[] = $value === '' ? null : $value;
                }
            }

            if (empty($updates)) {
                apiResponse(false, null, 'No fields to update');
            }

            $params[] = $customerId;
            $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            logActivity(
                $admin['user_id'],
                'customer_update',
                'user',
                $customerId,
                "Updated customer '{$customer['name']}' ({$customer['user_code']})",
                ['updated_fields' => array_keys(array_filter($input, fn($k) => in_array($k, $allowedFields), ARRAY_FILTER_USE_KEY))]
            );

            // Return updated customer data
            $stmt = $db->prepare("SELECT id, user_code, name, phone, email, status, avatar, created_at FROM users WHERE id = ?");
            $stmt->execute([$customerId]);
            $updatedCustomer = $stmt->fetch();

            apiResponse(true, ['customer' => $updatedCustomer], 'Customer updated successfully');
            break;

        case 'change_status':
            $customerId = sanitizeInt($input['customer_id'] ?? 0);
            $newStatus = sanitizeString($input['status'] ?? '');

            if ($customerId <= 0) {
                apiResponse(false, null, 'Customer ID is required');
            }
            if (!in_array($newStatus, ['active', 'inactive', 'banned'])) {
                apiResponse(false, null, 'Invalid status. Must be active, inactive, or banned');
            }

            // Verify customer exists
            $stmt = $db->prepare("SELECT id, name, user_code, status FROM users WHERE id = ? AND role = 'customer'");
            $stmt->execute([$customerId]);
            $customer = $stmt->fetch();
            if (!$customer) {
                apiResponse(false, null, 'Customer not found', 404);
            }

            if ($customer['status'] === $newStatus) {
                apiResponse(false, null, "Customer is already {$newStatus}");
            }

            $oldStatus = $customer['status'];
            $stmt = $db->prepare("UPDATE users SET status = ? WHERE id = ?");
            $stmt->execute([$newStatus, $customerId]);

            logActivity(
                $admin['user_id'],
                'customer_status_changed',
                'user',
                $customerId,
                "Changed status of '{$customer['name']}' ({$customer['user_code']}) from {$oldStatus} to {$newStatus}",
                ['old_status' => $oldStatus, 'new_status' => $newStatus]
            );

            apiResponse(true, ['status' => $newStatus], "Customer status changed to {$newStatus}");
            break;

        case 'delete':
            // Only super_admin can delete customers
            if ($admin['role'] !== 'super_admin') {
                apiResponse(false, null, 'Only super admin can delete customers', 403);
            }

            $customerId = sanitizeInt($input['customer_id'] ?? 0);
            if ($customerId <= 0) {
                apiResponse(false, null, 'Customer ID is required');
            }

            // Verify customer exists and is a customer
            $stmt = $db->prepare("SELECT id, name, user_code, role FROM users WHERE id = ? AND role = 'customer'");
            $stmt->execute([$customerId]);
            $customer = $stmt->fetch();

            if (!$customer) {
                apiResponse(false, null, 'Customer not found', 404);
            }

            try {
                $db->beginTransaction();

                // Delete related records in order
                $db->prepare("DELETE FROM tokens WHERE user_id = ?")->execute([$customerId]);
                $db->prepare("DELETE FROM redemptions WHERE user_id = ?")->execute([$customerId]);
                $db->prepare("DELETE FROM loyalty_cards WHERE user_id = ?")->execute([$customerId]);
                $db->prepare("DELETE FROM vehicles WHERE user_id = ?")->execute([$customerId]);
                $db->prepare("DELETE FROM activity_log WHERE user_id = ?")->execute([$customerId]);

                // Delete the customer
                $db->prepare("DELETE FROM users WHERE id = ? AND role = 'customer'")->execute([$customerId]);

                $db->commit();

                // Log activity
                logActivity(
                    $admin['user_id'],
                    'customer_delete',
                    'user',
                    $customerId,
                    "Deleted customer '{$customer['name']}' ({$customer['user_code']})",
                    [
                        'deleted_customer_id' => $customerId,
                        'deleted_customer_name' => $customer['name'],
                        'deleted_customer_code' => $customer['user_code']
                    ]
                );

                apiResponse(true, null, "Customer '{$customer['name']}' has been deleted");

            } catch (Exception $e) {
                $db->rollBack();
                apiResponse(false, null, 'Failed to delete customer: ' . $e->getMessage());
            }
            break;

        default:
            apiResponse(false, null, 'Invalid action');
    }
    exit;
}

$action = sanitizeString($_GET['action'] ?? 'list');

switch ($action) {
    case 'search':
        $q = sanitizeString($_GET['q'] ?? '');
        if (strlen($q) < 1) {
            apiResponse(false, null, 'Search query is required');
        }

        $searchTerm = "%$q%";
        // Also search by plate number
        $stmt = $db->prepare("
            SELECT DISTINCT u.id, u.user_code, u.name, u.phone, u.email, u.avatar, u.google_id, u.status, u.created_at,
                   lc.id as card_id, lc.card_number, lc.tokens_earned, lc.tokens_required, lc.status as card_status
            FROM users u
            LEFT JOIN loyalty_cards lc ON u.id = lc.user_id AND lc.status = 'active'
            LEFT JOIN vehicles v ON u.id = v.user_id AND v.status = 'active'
            WHERE u.role = 'customer'
              AND (u.user_code LIKE ? OR u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR v.plate_number LIKE ?)
            ORDER BY u.name ASC
            LIMIT 20
        ");
        $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm]);
        $customers = $stmt->fetchAll();

        // Type cast and add vehicles + completed cards count
        foreach ($customers as &$c) {
            $c['id'] = (int)$c['id'];
            $c['card_id'] = $c['card_id'] ? (int)$c['card_id'] : null;
            $c['tokens_earned'] = $c['tokens_earned'] ? (int)$c['tokens_earned'] : 0;
            $c['tokens_required'] = $c['tokens_required'] ? (int)$c['tokens_required'] : 10;

            // Get all vehicle plates (primary first)
            $stmtV = $db->prepare("
                SELECT plate_number FROM vehicles
                WHERE user_id = ? AND status = 'active'
                ORDER BY is_primary DESC, created_at ASC
            ");
            $stmtV->execute([$c['id']]);
            $plates = $stmtV->fetchAll(PDO::FETCH_COLUMN);
            $c['plate_number'] = $plates[0] ?? null;
            $c['plate_numbers'] = $plates;

            // Count completed + redeemed cards
            $stmtCards = $db->prepare("
                SELECT COUNT(*) FROM loyalty_cards
                WHERE user_id = ? AND status IN ('completed', 'redeemed')
            ");
            $stmtCards->execute([$c['id']]);
            $c['completed_cards'] = (int)$stmtCards->fetchColumn();
        }

        apiResponse(true, ['customers' => $customers]);
        break;

    case 'list':
        $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit  = min(50, max(5, sanitizeInt($_GET['limit'] ?? 10)));
        $offset = ($page - 1) * $limit;
        $sort   = sanitizeString($_GET['sort'] ?? 'newest');

        $orderBy = match($sort) {
            'name'    => 'u.name ASC',
            'oldest'  => 'u.created_at ASC',
            'code'    => 'u.user_code ASC',
            default   => 'u.created_at DESC'
        };

        // Total count
        $stmt = $db->query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
        $total = (int)$stmt->fetchColumn();

        // List with active card
        $stmt = $db->prepare("
            SELECT u.id, u.user_code, u.name, u.phone, u.email, u.avatar, u.google_id, u.status, u.last_login, u.created_at,
                   lc.id as card_id, lc.card_number, lc.tokens_earned, lc.tokens_required, lc.status as card_status
            FROM users u
            LEFT JOIN loyalty_cards lc ON u.id = lc.user_id AND lc.status = 'active'
            WHERE u.role = 'customer'
            ORDER BY $orderBy
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute();
        $customers = $stmt->fetchAll();

        foreach ($customers as &$c) {
            $c['id'] = (int)$c['id'];
            $c['card_id'] = $c['card_id'] ? (int)$c['card_id'] : null;
            $c['tokens_earned'] = $c['tokens_earned'] ? (int)$c['tokens_earned'] : 0;
            $c['tokens_required'] = $c['tokens_required'] ? (int)$c['tokens_required'] : 10;

            // Get all vehicle plates (primary first)
            $stmtV = $db->prepare("
                SELECT plate_number FROM vehicles
                WHERE user_id = ? AND status = 'active'
                ORDER BY is_primary DESC, created_at ASC
            ");
            $stmtV->execute([$c['id']]);
            $plates = $stmtV->fetchAll(PDO::FETCH_COLUMN);
            $c['plate_number'] = $plates[0] ?? null;
            $c['plate_numbers'] = $plates;

            // Count completed + redeemed cards
            $stmtCards = $db->prepare("
                SELECT COUNT(*) FROM loyalty_cards
                WHERE user_id = ? AND status IN ('completed', 'redeemed')
            ");
            $stmtCards->execute([$c['id']]);
            $c['completed_cards'] = (int)$stmtCards->fetchColumn();
        }

        apiResponse(true, [
            'customers' => $customers,
            'total'     => $total,
            'page'      => $page,
            'pages'     => ceil($total / $limit)
        ]);
        break;

    case 'detail':
        $customerId = sanitizeInt($_GET['id'] ?? 0);
        if ($customerId <= 0) {
            apiResponse(false, null, 'Customer ID is required');
        }

        // Customer info
        $stmt = $db->prepare("
            SELECT id, user_code, name, phone, email, status, avatar, last_login, created_at
            FROM users WHERE id = ? AND role = 'customer'
        ");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) {
            apiResponse(false, null, 'Customer not found', 404);
        }
        $customer['id'] = (int)$customer['id'];

        // Get vehicles
        $stmt = $db->prepare("
            SELECT id, plate_number, vehicle_type, vehicle_model, is_primary, created_at
            FROM vehicles
            WHERE user_id = ? AND status = 'active'
            ORDER BY is_primary DESC, created_at ASC
        ");
        $stmt->execute([$customerId]);
        $vehicles = $stmt->fetchAll();
        foreach ($vehicles as &$v) {
            $v['id'] = (int)$v['id'];
            $v['is_primary'] = (bool)$v['is_primary'];
        }

        // All cards
        $stmt = $db->prepare("
            SELECT id, card_number, tokens_required, tokens_earned, status, completed_at, redeemed_at, created_at
            FROM loyalty_cards
            WHERE user_id = ?
            ORDER BY card_number DESC
        ");
        $stmt->execute([$customerId]);
        $cards = $stmt->fetchAll();

        foreach ($cards as &$card) {
            $card['id'] = (int)$card['id'];
            $card['tokens_required'] = (int)$card['tokens_required'];
            $card['tokens_earned'] = (int)$card['tokens_earned'];

            // Get tokens for each card (with vehicle info)
            $stmt2 = $db->prepare("
                SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
                       u.name as added_by_name, v.plate_number
                FROM tokens t
                LEFT JOIN users u ON t.added_by = u.id
                LEFT JOIN vehicles v ON t.vehicle_id = v.id
                WHERE t.card_id = ?
                ORDER BY t.token_position ASC
            ");
            $stmt2->execute([$card['id']]);
            $card['tokens'] = $stmt2->fetchAll();
        }

        // Stats
        $stmt = $db->prepare("SELECT COUNT(*) FROM tokens WHERE user_id = ?");
        $stmt->execute([$customerId]);
        $totalTokens = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COUNT(*) FROM redemptions WHERE user_id = ?");
        $stmt->execute([$customerId]);
        $totalRedemptions = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE user_id = ? AND amount IS NOT NULL");
        $stmt->execute([$customerId]);
        $totalSpend = (float)$stmt->fetchColumn();

        apiResponse(true, [
            'customer' => $customer,
            'vehicles' => $vehicles,
            'cards'    => $cards,
            'stats'    => [
                'total_tokens'      => $totalTokens,
                'total_redemptions' => $totalRedemptions,
                'total_spend'       => $totalSpend,
                'total_cards'       => count($cards)
            ]
        ]);
        break;

    default:
        apiResponse(false, null, 'Invalid action');
}
