<?php
/**
 * Admin Token Management - CORE BUSINESS LOGIC
 * POST action=add: Add token to customer's card (vehicle_id required)
 * GET action=history: Token history for a customer
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = getInput();
    $action = sanitizeString($input['action'] ?? 'add');

    if ($action === 'add') {
        $customerId    = sanitizeInt($input['customer_id'] ?? 0);
        $vehicleId     = sanitizeInt($input['vehicle_id'] ?? 0);
        $amount        = sanitizeFloat($input['amount'] ?? 0);
        $discount      = sanitizeFloat($input['discount'] ?? 0);
        $tokenCount    = max(1, sanitizeInt($input['token_count'] ?? 1));
        $notes         = sanitizeString($input['notes'] ?? '');
        $paymentMethod = sanitizeString($input['payment_method'] ?? 'cash');
        $cashAmount    = isset($input['cash_amount']) ? sanitizeFloat($input['cash_amount']) : null;
        $onlineAmount  = isset($input['online_amount']) ? sanitizeFloat($input['online_amount']) : null;

        // Validate discount
        if ($discount < 0) $discount = 0;

        if (!in_array($paymentMethod, ['cash', 'online', 'split'])) {
            $paymentMethod = 'cash';
        }
        if ($paymentMethod === 'cash') {
            $cashAmount = $amount;
            $onlineAmount = null;
        } elseif ($paymentMethod === 'online') {
            $cashAmount = null;
            $onlineAmount = $amount;
        }

        if ($customerId <= 0) {
            apiResponse(false, null, 'Customer ID is required');
        }

        // Verify customer exists
        $stmt = $db->prepare("SELECT id, name, user_code FROM users WHERE id = ? AND role = 'customer' AND status = 'active'");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) {
            apiResponse(false, null, 'Customer not found');
        }

        // Get settings
        $settings = getSettings(['min_spend_enabled', 'min_spend', 'payment_tracking_enabled', 'tokens_per_card', 'reward_description', 'require_vehicle']);
        $requireVehicle = ($settings['require_vehicle'] ?? '1') === '1';

        // Verify vehicle if required
        $vehicle = null;
        if ($requireVehicle) {
            if ($vehicleId <= 0) {
                apiResponse(false, null, 'Please select a vehicle (plate number)');
            }
            $stmt = $db->prepare("SELECT id, plate_number FROM vehicles WHERE id = ? AND user_id = ? AND status = 'active'");
            $stmt->execute([$vehicleId, $customerId]);
            $vehicle = $stmt->fetch();
            if (!$vehicle) {
                apiResponse(false, null, 'Vehicle not found or does not belong to this customer');
            }
        } else {
            $vehicleId = null;
        }
        $tokensPerCard = (int)($settings['tokens_per_card'] ?: 10);

        // Check minimum spend
        if ($settings['min_spend_enabled'] === '1' && $settings['payment_tracking_enabled'] === '1') {
            $minSpend = (float)$settings['min_spend'];
            if ($amount < $minSpend) {
                apiResponse(false, null, "Minimum spend of " . currency() . number_format($minSpend, 2) . " required to earn a token");
            }
        }

        // Cap token count to a safe maximum (100)
        $tokenCount = min($tokenCount, 100);

        // Calculate amount per token (split evenly)
        $amountPerToken = ($settings['payment_tracking_enabled'] === '1' && $amount > 0)
            ? round($amount / $tokenCount, 2)
            : null;

        $db->beginTransaction();
        try {
            $tokensAdded = 0;
            $isCompleted = false;
            $card = null;

            for ($i = 0; $i < $tokenCount; $i++) {
                // Get or create active card
                $stmt = $db->prepare("
                    SELECT id, card_number, tokens_required, tokens_earned
                    FROM loyalty_cards
                    WHERE user_id = ? AND status = 'active'
                    FOR UPDATE
                ");
                $stmt->execute([$customerId]);
                $card = $stmt->fetch();

                if (!$card) {
                    // Create new card
                    $stmt = $db->prepare("SELECT COALESCE(MAX(card_number), 0) FROM loyalty_cards WHERE user_id = ?");
                    $stmt->execute([$customerId]);
                    $nextCardNum = (int)$stmt->fetchColumn() + 1;

                    $stmt = $db->prepare("
                        INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status)
                        VALUES (?, ?, ?, 0, 'active')
                    ");
                    $stmt->execute([$customerId, $nextCardNum, $tokensPerCard]);
                    $card = [
                        'id' => (int)$db->lastInsertId(),
                        'card_number' => $nextCardNum,
                        'tokens_required' => $tokensPerCard,
                        'tokens_earned' => 0
                    ];
                }

                // Safety: skip if card already full
                if ((int)$card['tokens_earned'] >= (int)$card['tokens_required']) {
                    continue;
                }

                $tokenPosition = (int)$card['tokens_earned'] + 1;

                // Insert token — first token gets full amount remainder if not splitting evenly
                $tokenAmount = $amountPerToken;
                if ($i === 0 && $amountPerToken !== null) {
                    // First token gets any rounding remainder
                    $tokenAmount = round($amount - ($amountPerToken * ($tokenCount - 1)), 2);
                }

                $stmt = $db->prepare("
                    INSERT INTO tokens (card_id, user_id, added_by, vehicle_id, token_position, amount, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $card['id'],
                    $customerId,
                    $admin['user_id'],
                    $vehicleId,
                    $tokenPosition,
                    $tokenAmount,
                    ($i === 0 && $notes) ? $notes : null
                ]);
                $tokenId = (int)$db->lastInsertId();
                $tokensAdded++;

                // Update card
                $newTokenCount = (int)$card['tokens_earned'] + 1;
                $isCompleted = ($newTokenCount >= (int)$card['tokens_required']);

                if ($isCompleted) {
                    $stmt = $db->prepare("
                        UPDATE loyalty_cards
                        SET tokens_earned = ?, status = 'completed', completed_at = NOW()
                        WHERE id = ?
                    ");
                    $stmt->execute([$newTokenCount, $card['id']]);

                    logActivity($admin['user_id'], 'card_completed', 'card', $card['id'],
                        "Card #{$card['card_number']} completed for {$customer['name']}",
                        ['customer_id' => $customerId]
                    );
                } else {
                    $stmt = $db->prepare("UPDATE loyalty_cards SET tokens_earned = ? WHERE id = ?");
                    $stmt->execute([$newTokenCount, $card['id']]);
                }

                $plateTxt = $vehicle ? $vehicle['plate_number'] : 'N/A';
                logActivity($admin['user_id'], 'token_added', 'token', $tokenId,
                    "Token #{$tokenPosition} added for {$customer['name']}" . ($vehicle ? " ({$plateTxt})" : ""),
                    ['card_id' => $card['id'], 'amount' => $tokenAmount, 'customer_id' => $customerId, 'vehicle' => $plateTxt]
                );

                // Update card variable for next loop iteration
                $card['tokens_earned'] = $newTokenCount;
            }

            // Log to transactions table
            $stmt = $db->prepare("
                INSERT INTO transactions (user_id, vehicle_id, card_id, amount, discount, token_count, notes, added_by, payment_method, cash_amount, online_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $customerId,
                $vehicleId,
                $card ? $card['id'] : null,
                $amount,
                $discount,
                $tokensAdded,
                $notes ?: null,
                $admin['user_id'],
                $paymentMethod,
                $cashAmount,
                $onlineAmount
            ]);

            $db->commit();

            // Save notification data before sending response
            $notifyCustomerId = $customerId;
            $notifyCompleted = $isCompleted;
            $notifyRewardDesc = $settings['reward_description'] ?? 'FREE reward';
            $notifyBusinessName = getSetting('business_name') ?: 'Loyalty Card';
            $notifyTokensAdded = $tokensAdded;
            $notifyCardEarned = $card['tokens_earned'];
            $notifyCardRequired = $card['tokens_required'];

            // Re-fetch the latest active or completed card for UI
            $stmt = $db->prepare("
                SELECT id, card_number, tokens_required, tokens_earned, status
                FROM loyalty_cards
                WHERE user_id = ? AND status IN ('active', 'completed')
                ORDER BY card_number DESC
                LIMIT 1
            ");
            $stmt->execute([$customerId]);
            $latestCard = $stmt->fetch();

            if ($latestCard) {
                // Get tokens for display
                $stmt = $db->prepare("
                    SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
                           u.name as added_by_name, v.plate_number
                    FROM tokens t
                    LEFT JOIN users u ON t.added_by = u.id
                    LEFT JOIN vehicles v ON t.vehicle_id = v.id
                    WHERE t.card_id = ?
                    ORDER BY t.token_position ASC
                ");
                $stmt->execute([$latestCard['id']]);
                $tokens = $stmt->fetchAll();

                // Total amount for this card
                $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM tokens WHERE card_id = ? AND amount IS NOT NULL");
                $stmt->execute([$latestCard['id']]);
                $cardTotalAmount = (float)$stmt->fetchColumn();

                $responseCard = [
                    'id'              => (int)$latestCard['id'],
                    'card_number'     => (int)$latestCard['card_number'],
                    'tokens_earned'   => (int)$latestCard['tokens_earned'],
                    'tokens_required' => (int)$latestCard['tokens_required'],
                    'status'          => $latestCard['status'],
                    'is_completed'    => $latestCard['status'] === 'completed',
                    'tokens'          => $tokens,
                    'total_amount'    => $cardTotalAmount
                ];
            } else {
                $responseCard = null;
            }

            $tokenWord = $tokensAdded === 1 ? 'token' : 'tokens';
            $vehicleLabel = $vehicle ? " ({$vehicle['plate_number']})" : "";
            $message = $isCompleted
                ? "🎉 Card complete! {$customer['name']} earned a FREE reward! (+{$tokensAdded} {$tokenWord})"
                : "✅ {$tokensAdded} {$tokenWord} added for {$customer['name']}{$vehicleLabel}";

            // Flush success response to client FIRST
            http_response_code(200);
            header('Content-Type: application/json');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            $json = json_encode(array_merge([
                'success' => true,
                'message' => $message,
                'card' => $responseCard,
                'customer' => $customer,
                'vehicle'  => $vehicle,
                'tokens_added' => $tokensAdded,
                'reward_description' => $settings['reward_description'] ?? ''
            ]), JSON_UNESCAPED_UNICODE);
            header('Content-Length: ' . strlen($json));
            echo $json;
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                ob_end_flush();
                flush();
            }

            // Send push notification AFTER response (best-effort)
            try {
                if (file_exists(__DIR__ . '/../helpers/notify.php')) {
                    require_once __DIR__ . '/../helpers/notify.php';
                    if (function_exists('notifyUserAll')) {
                        if ($notifyCompleted) {
                            notifyUserAll($notifyCustomerId, 'Card Complete!',
                                "Tahniah! Kad loyalti anda penuh. Tebus ganjaran: $notifyRewardDesc",
                                '/users/');
                        } else {
                            notifyUserAll($notifyCustomerId, $notifyBusinessName,
                                "+$notifyTokensAdded token ditambah. $notifyCardEarned/$notifyCardRequired selesai.",
                                '/users/');
                        }
                    }
                }
            } catch (\Throwable $e) { /* silent */ }
            exit;

        } catch (\Throwable $e) {
            $db->rollBack();
            apiResponse(false, null, 'Failed to add token: ' . $e->getMessage(), 500);
        }

    } elseif ($action === 'record_payment') {
        // Record payment only (no tokens) - for amounts below min spend
        $customerId    = sanitizeInt($input['customer_id'] ?? 0);
        $vehicleId     = sanitizeInt($input['vehicle_id'] ?? 0);
        $amount        = sanitizeFloat($input['amount'] ?? 0);
        $rpDiscount    = sanitizeFloat($input['discount'] ?? 0);
        $notes         = sanitizeString($input['notes'] ?? '');
        $rpPaymentMethod = sanitizeString($input['payment_method'] ?? 'cash');
        $rpCashAmount    = isset($input['cash_amount']) ? sanitizeFloat($input['cash_amount']) : null;
        $rpOnlineAmount  = isset($input['online_amount']) ? sanitizeFloat($input['online_amount']) : null;
        if ($rpDiscount < 0) $rpDiscount = 0;

        if (!in_array($rpPaymentMethod, ['cash', 'online', 'split'])) {
            $rpPaymentMethod = 'cash';
        }
        if ($rpPaymentMethod === 'cash') {
            $rpCashAmount = $amount;
            $rpOnlineAmount = null;
        } elseif ($rpPaymentMethod === 'online') {
            $rpCashAmount = null;
            $rpOnlineAmount = $amount;
        }

        if ($customerId <= 0) apiResponse(false, null, 'Customer ID is required');
        if ($amount <= 0) apiResponse(false, null, 'Amount must be greater than 0');

        // Verify customer
        $stmt = $db->prepare("SELECT id, name, user_code FROM users WHERE id = ? AND role = 'customer' AND status = 'active'");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) apiResponse(false, null, 'Customer not found');

        // Check vehicle requirement
        $rpSettings = getSettings(['require_vehicle']);
        $requireVehicle = ($rpSettings['require_vehicle'] ?? '1') === '1';
        $vehicle = null;

        if ($requireVehicle) {
            if ($vehicleId <= 0) apiResponse(false, null, 'Please select a vehicle');
            $stmt = $db->prepare("SELECT id, plate_number FROM vehicles WHERE id = ? AND user_id = ? AND status = 'active'");
            $stmt->execute([$vehicleId, $customerId]);
            $vehicle = $stmt->fetch();
            if (!$vehicle) apiResponse(false, null, 'Vehicle not found');
        } else {
            $vehicleId = null;
        }

        // Get active card id (if any) for reference
        $stmt = $db->prepare("SELECT id FROM loyalty_cards WHERE user_id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$customerId]);
        $activeCard = $stmt->fetch();

        try {
            // Record in transactions table
            $stmt = $db->prepare("
                INSERT INTO transactions (user_id, vehicle_id, card_id, amount, discount, token_count, notes, added_by, payment_method, cash_amount, online_amount)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $customerId,
                $vehicleId,
                $activeCard ? $activeCard['id'] : null,
                $amount,
                $rpDiscount,
                $notes ?: null,
                $admin['user_id'],
                $rpPaymentMethod,
                $rpCashAmount,
                $rpOnlineAmount
            ]);

            $rpPlate = $vehicle ? $vehicle['plate_number'] : 'N/A';
            $rpVehicleLabel = $vehicle ? " ({$rpPlate})" : "";
            logActivity($admin['user_id'], 'payment_recorded', 'transaction', (int)$db->lastInsertId(),
                "Payment " . currency() . number_format($amount, 2) . " recorded for {$customer['name']}{$rpVehicleLabel} - no token",
                ['customer_id' => $customerId, 'amount' => $amount, 'vehicle' => $rpPlate]
            );

            apiResponse(true, [
                'customer' => $customer,
                'vehicle'  => $vehicle,
                'amount'   => $amount
            ], "Payment " . currency() . number_format($amount, 2) . " recorded for {$customer['name']}{$rpVehicleLabel}. No token awarded (below minimum).");

        } catch (Exception $e) {
            apiResponse(false, null, 'Failed to record payment: ' . $e->getMessage(), 500);
        }
    }

} elseif ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'history');

    if ($action === 'history') {
        $customerId = sanitizeInt($_GET['customer_id'] ?? 0);
        $page  = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit = min(50, max(10, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where = "1=1";
        $params = [];
        if ($customerId > 0) {
            $where .= " AND t.user_id = ?";
            $params[] = $customerId;
        }

        $stmt = $db->prepare("SELECT COUNT(*) FROM tokens t WHERE $where");
        $stmt->execute($params);
        $total = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("
            SELECT t.*, u.name as customer_name, u.user_code as customer_code,
                   a.name as added_by_name, v.plate_number
            FROM tokens t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users a ON t.added_by = a.id
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            WHERE $where
            ORDER BY t.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $tokens = $stmt->fetchAll();

        apiResponse(true, [
            'tokens' => $tokens,
            'total'  => $total,
            'page'   => $page,
            'pages'  => ceil($total / $limit)
        ]);
    }
}
