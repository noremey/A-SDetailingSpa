<?php
/**
 * Admin Business Settings
 * GET: Get all settings
 * PUT: Update settings
 * POST action=upload_logo: Upload business logo
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $settings = getSettings();
    apiResponse(true, ['settings' => $settings]);

} elseif ($method === 'PUT') {
    $input = getInput();
    $allowedKeys = [
        'business_name', 'business_phone', 'business_email', 'business_address',
        'business_type', 'tokens_per_card', 'min_spend', 'min_spend_enabled',
        'payment_tracking_enabled', 'require_vehicle', 'reward_description', 'primary_color',
        'secondary_color', 'currency_symbol', 'language',
        'staff_visible_menus',
        'admin_visible_menus',
        'super_admin_visible_menus',
        'push_notifications_enabled',
        'pos_quick_quantities',
        'pos_quantity_picker'
    ];

    $updated = [];
    foreach ($allowedKeys as $key) {
        if (isset($input[$key])) {
            // Use trim only — no htmlspecialchars. PDO prepared statements handle SQL safety,
            // and React auto-escapes on render for XSS safety.
            $value = trim((string)$input[$key]);
            updateSetting($key, $value);
            $updated[$key] = $value;
        }
    }

    if (empty($updated)) {
        apiResponse(false, null, 'No settings to update');
    }

    // Sync tokens_per_card to all active loyalty cards
    if (isset($updated['tokens_per_card'])) {
        $newTokensRequired = (int)$updated['tokens_per_card'];

        // First: mark cards as completed where tokens_earned >= new tokens_required
        $stmt = $db->prepare("
            UPDATE loyalty_cards
            SET status = 'completed', tokens_required = ?, completed_at = NOW()
            WHERE status = 'active' AND tokens_earned >= ?
        ");
        $stmt->execute([$newTokensRequired, $newTokensRequired]);
        $completedCount = $stmt->rowCount();

        // Then: update remaining active cards to new tokens_required
        $stmt = $db->prepare("
            UPDATE loyalty_cards
            SET tokens_required = ?
            WHERE status = 'active'
        ");
        $stmt->execute([$newTokensRequired]);
        $syncedCount = $stmt->rowCount();

        if ($completedCount > 0 || $syncedCount > 0) {
            logActivity($admin['user_id'], 'tokens_per_card_synced', 'settings', null,
                "Synced tokens_per_card to $newTokensRequired for active cards",
                ['synced' => $syncedCount, 'auto_completed' => $completedCount]
            );
        }
    }

    logActivity($admin['user_id'], 'settings_updated', 'settings', null,
        'Business settings updated',
        ['updated_keys' => array_keys($updated)]
    );

    $allSettings = getSettings();
    apiResponse(true, ['settings' => $allSettings], 'Settings updated successfully');

} elseif ($method === 'POST') {
    // POST can be multipart/form-data (file upload) or JSON
    $action = '';
    if (!empty($_POST['action'])) {
        $action = sanitizeString($_POST['action']);
    } else {
        $input = getInput();
        $action = sanitizeString($input['action'] ?? '');
    }

    if ($action === 'upload_logo') {
        if (!isset($_FILES['logo'])) {
            apiResponse(false, null, 'No logo file uploaded');
        }

        $file = $_FILES['logo'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

        if (!in_array($file['type'], $allowedTypes)) {
            apiResponse(false, null, 'Invalid file type. Use JPG, PNG, GIF, WebP, or SVG.');
        }

        if ($file['size'] > 2 * 1024 * 1024) {
            apiResponse(false, null, 'File too large. Max 2MB.');
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = 'logo_' . time() . '.' . $ext;
        $uploadPath = UPLOAD_DIR . $filename;

        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }

        if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
            // Delete old logo
            $oldLogo = getSetting('business_logo');
            if ($oldLogo && file_exists(UPLOAD_DIR . basename($oldLogo))) {
                unlink(UPLOAD_DIR . basename($oldLogo));
            }

            // Dynamically detect base path (works in both local & production)
            $basePath = str_replace('/api/admin/settings.php', '', $_SERVER['SCRIPT_NAME']);
            $logoUrl = $basePath . '/uploads/' . $filename;
            updateSetting('business_logo', $logoUrl);

            logActivity($admin['user_id'], 'logo_uploaded', 'settings', null, 'Business logo uploaded');

            apiResponse(true, ['logo_url' => $logoUrl], 'Logo uploaded successfully');
        } else {
            apiResponse(false, null, 'Failed to upload logo', 500);
        }

    } elseif ($action === 'remove_logo') {
        $oldLogo = getSetting('business_logo');
        if ($oldLogo && file_exists(UPLOAD_DIR . basename($oldLogo))) {
            unlink(UPLOAD_DIR . basename($oldLogo));
        }
        updateSetting('business_logo', '');

        logActivity($admin['user_id'], 'logo_removed', 'settings', null, 'Business logo removed');

        apiResponse(true, null, 'Logo removed successfully');
    }
}
