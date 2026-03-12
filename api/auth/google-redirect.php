<?php
/**
 * Google OAuth 2.0 Redirect Flow
 * Works on all devices including iPhone/iPad Safari
 *
 * GET ?action=login   → Redirect user to Google consent screen
 * GET ?action=callback → Handle callback from Google, exchange code for token
 */
require_once __DIR__ . '/../config/app.php';

$action = $_GET['action'] ?? '';
$db = getDB();

// Determine the base URL dynamically
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$basePath = str_replace('/api/auth/google-redirect.php', '', $_SERVER['SCRIPT_NAME']);
$baseUrl = $protocol . '://' . $host . $basePath;
$callbackUrl = $baseUrl . '/api/auth/google-redirect.php?action=callback';

if ($action === 'login') {
    // ─── Step 1: Redirect to Google ─────────────────────────────
    $state = bin2hex(random_bytes(16));

    // Store state in session for CSRF protection
    session_start();
    $_SESSION['google_oauth_state'] = $state;
    $_SESSION['google_oauth_mode'] = $_GET['mode'] ?? 'login'; // login or register
    // Mobile app support: store source and return URL for deep linking
    $_SESSION['google_oauth_source'] = $_GET['source'] ?? '';
    $_SESSION['google_oauth_return_to'] = $_GET['return_to'] ?? '';

    $params = http_build_query([
        'client_id'     => GOOGLE_CLIENT_ID,
        'redirect_uri'  => $callbackUrl,
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $state,
        'access_type'   => 'online',
        'prompt'        => 'select_account',
    ]);

    header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
    exit;

} elseif ($action === 'callback') {
    // ─── Step 2: Handle Google callback ─────────────────────────
    session_start();

    $code  = $_GET['code'] ?? '';
    $state = $_GET['state'] ?? '';
    $error = $_GET['error'] ?? '';

    // Check for errors from Google
    if ($error) {
        redirectWithError($baseUrl, 'Google sign-in was cancelled');
        exit;
    }

    // Verify state to prevent CSRF
    $expectedState = $_SESSION['google_oauth_state'] ?? '';
    if (empty($state) || $state !== $expectedState) {
        redirectWithError($baseUrl, 'Invalid request. Please try again.');
        exit;
    }

    // Clear used state
    unset($_SESSION['google_oauth_state']);

    if (empty($code)) {
        redirectWithError($baseUrl, 'Authorization failed. Please try again.');
        exit;
    }

    // ─── Exchange code for tokens ───────────────────────────────
    // Need GOOGLE_CLIENT_SECRET - check if defined
    if (!defined('GOOGLE_CLIENT_SECRET') || empty(GOOGLE_CLIENT_SECRET)) {
        redirectWithError($baseUrl, 'Server configuration error. Contact admin.');
        exit;
    }

    $tokenResponse = curlPost('https://oauth2.googleapis.com/token', [
        'code'          => $code,
        'client_id'     => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri'  => $callbackUrl,
        'grant_type'    => 'authorization_code',
    ]);

    if (!$tokenResponse || empty($tokenResponse['id_token'])) {
        redirectWithError($baseUrl, 'Failed to verify with Google. Please try again.');
        exit;
    }

    // ─── Verify the ID token ────────────────────────────────────
    $googleUser = verifyGoogleToken($tokenResponse['id_token']);
    if (!$googleUser || empty($googleUser['email'])) {
        redirectWithError($baseUrl, 'Failed to get Google profile. Please try again.');
        exit;
    }

    // ─── Login or register the user (same logic as google.php) ──
    $isNewUser = false;

    // Check existing user by google_id
    $stmt = $db->prepare("
        SELECT id, user_code, name, phone, email, password, role, status, avatar, google_id
        FROM users WHERE google_id = ? LIMIT 1
    ");
    $stmt->execute([$googleUser['google_id']]);
    $user = $stmt->fetch();

    // If not found, try by email
    if (!$user) {
        $stmt = $db->prepare("
            SELECT id, user_code, name, phone, email, password, role, status, avatar, google_id
            FROM users WHERE email = ? AND (google_id IS NULL OR google_id = '') LIMIT 1
        ");
        $stmt->execute([$googleUser['email']]);
        $user = $stmt->fetch();
    }

    if ($user) {
        // Existing user
        if ($user['status'] !== 'active') {
            redirectWithError($baseUrl, 'Account is inactive or banned');
            exit;
        }

        // Link google_id if not yet linked
        if (empty($user['google_id'])) {
            $stmt = $db->prepare("UPDATE users SET google_id = ? WHERE id = ?");
            $stmt->execute([$googleUser['google_id'], $user['id']]);
        }

        // Update avatar from Google if not set
        if (empty($user['avatar']) && !empty($googleUser['picture'])) {
            $stmt = $db->prepare("UPDATE users SET avatar = ? WHERE id = ?");
            $stmt->execute([$googleUser['picture'], $user['id']]);
        }

        // Update last_login
        $stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$user['id']]);

        logActivity($user['id'], 'google_login', 'user', $user['id'], $user['name'] . ' logged in via Google');

    } else {
        // New user - auto register
        $isNewUser = true;
        $db->beginTransaction();

        try {
            $userCode = generateUserCode();
            $hashedPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
            $role = isSuperAdminEmail($googleUser['email']) ? 'super_admin' : 'customer';

            $stmt = $db->prepare("
                INSERT INTO users (user_code, name, phone, email, password, role, status, avatar, google_id)
                VALUES (?, ?, NULL, ?, ?, ?, 'active', ?, ?)
            ");
            $stmt->execute([
                $userCode,
                $googleUser['name'],
                $googleUser['email'],
                $hashedPassword,
                $role,
                $googleUser['picture'] ?? null,
                $googleUser['google_id']
            ]);
            $userId = (int)$db->lastInsertId();

            // Create first loyalty card for customers
            if ($role === 'customer') {
                $tokensPerCard = (int)(getSetting('tokens_per_card') ?: 10);
                $stmt = $db->prepare("
                    INSERT INTO loyalty_cards (user_id, card_number, tokens_required, tokens_earned, status)
                    VALUES (?, 1, ?, 0, 'active')
                ");
                $stmt->execute([$userId, $tokensPerCard]);
            }

            logActivity($userId, 'google_register', 'user', $userId, "User {$googleUser['name']} registered via Google");
            $db->commit();

            $user = [
                'id'        => $userId,
                'user_code' => $userCode,
                'name'      => $googleUser['name'],
                'phone'     => null,
                'email'     => $googleUser['email'],
                'role'      => $role,
                'avatar'    => $googleUser['picture'] ?? null,
                'google_id' => $googleUser['google_id'],
                'status'    => 'active',
            ];

        } catch (Exception $e) {
            $db->rollBack();
            redirectWithError($baseUrl, 'Registration failed. Please try again.');
            exit;
        }
    }

    // Check if customer needs phone or vehicle
    $needsVehicle = false;
    $needsPhone = false;
    if ($user['role'] === 'customer') {
        $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$user['id']]);
        $vehicleCount = (int)$stmt->fetchColumn();
        $needsVehicle = ($vehicleCount === 0);
        $needsPhone = empty($user['phone']);
    }

    // Generate JWT
    $jwtToken = jwtEncode([
        'user_id'   => (int)$user['id'],
        'user_code' => $user['user_code'],
        'role'      => $user['role'],
        'name'      => $user['name']
    ]);

    // Build user JSON for frontend
    $userData = json_encode([
        'id'        => (int)$user['id'],
        'user_code' => $user['user_code'],
        'name'      => $user['name'],
        'phone'     => $user['phone'] ?? null,
        'email'     => $user['email'],
        'role'      => $user['role'],
        'avatar'    => $user['avatar'] ?? null,
        'google_id' => $user['google_id'] ?? $googleUser['google_id'] ?? null
    ]);

    $needsProfileCompletion = ($needsVehicle || $needsPhone) ? 'true' : 'false';

    // Redirect to frontend with auth data in fragment (not query params for security)
    $fragment = http_build_query([
        'token'                    => $jwtToken,
        'user'                     => $userData,
        'is_new_user'              => $isNewUser ? '1' : '0',
        'needs_profile_completion' => $needsProfileCompletion,
    ]);

    // Mobile app callback: redirect to app's deep link instead of web
    $source = $_SESSION['google_oauth_source'] ?? '';
    $returnTo = $_SESSION['google_oauth_return_to'] ?? '';
    unset($_SESSION['google_oauth_source'], $_SESSION['google_oauth_return_to']);

    if ($source === 'mobile' && !empty($returnTo)) {
        header('Location: ' . $returnTo . '#' . $fragment);
        exit;
    }

    header('Location: ' . $baseUrl . '/auth/google/callback#' . $fragment);
    exit;

} else {
    apiResponse(false, null, 'Invalid action', 400);
}

// ─── Helper functions ───────────────────────────────────────────

function curlPost(string $url, array $data): ?array {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    return json_decode($response, true);
}

function redirectWithError(string $baseUrl, string $message): void {
    $fragment = http_build_query(['error' => $message]);
    header('Location: ' . $baseUrl . '/auth/google/callback#' . $fragment);
    exit;
}
