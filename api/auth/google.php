<?php
/**
 * Google Sign-In Authentication
 * POST: { credential: "google_id_token" }
 *
 * - Verifies Google ID token
 * - If user exists (by email or google_id): login
 * - If new user: auto-register as customer
 * - Special: noremey.rasip@gmail.com -> super_admin
 *
 * Returns: { token, user, is_new_user, needs_vehicle }
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$credential = $input['credential'] ?? '';

if (empty($credential)) {
    apiResponse(false, null, 'Google credential is required');
}

// Verify Google token
$googleUser = verifyGoogleToken($credential);
if (!$googleUser || empty($googleUser['email'])) {
    apiResponse(false, null, 'Invalid Google token. Please try again.', 401);
}

$db = getDB();
$isNewUser = false;

// Check if user already exists — first by google_id (exact match), then by email
$stmt = $db->prepare("
    SELECT id, user_code, name, phone, email, password, role, status, avatar, google_id
    FROM users
    WHERE google_id = ?
    LIMIT 1
");
$stmt->execute([$googleUser['google_id']]);
$user = $stmt->fetch();

// If not found by google_id, try by email (only unlinked accounts)
if (!$user) {
    $stmt = $db->prepare("
        SELECT id, user_code, name, phone, email, password, role, status, avatar, google_id
        FROM users
        WHERE email = ? AND (google_id IS NULL OR google_id = '')
        LIMIT 1
    ");
    $stmt->execute([$googleUser['email']]);
    $user = $stmt->fetch();
}

if ($user) {
    // Existing user - check status
    if ($user['status'] !== 'active') {
        apiResponse(false, null, 'Account is inactive or banned', 403);
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
        // Generate a random password (Google users won't use it)
        $hashedPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);

        // Determine role
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
        apiResponse(false, null, 'Registration failed. Please try again.', 500);
    }
}

// Check if customer needs phone or vehicle
$needsVehicle = false;
$needsPhone = false;
$userRole = $user['role'];
if ($userRole === 'customer') {
    $stmt = $db->prepare("SELECT COUNT(*) FROM vehicles WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$user['id']]);
    $vehicleCount = (int)$stmt->fetchColumn();
    $needsVehicle = ($vehicleCount === 0);
    $needsPhone = empty($user['phone']);
}

// Generate JWT
$token = jwtEncode([
    'user_id'   => (int)$user['id'],
    'user_code' => $user['user_code'],
    'role'      => $user['role'],
    'name'      => $user['name']
]);

apiResponse(true, [
    'token' => $token,
    'user'  => [
        'id'        => (int)$user['id'],
        'user_code' => $user['user_code'],
        'name'      => $user['name'],
        'phone'     => $user['phone'] ?? null,
        'email'     => $user['email'],
        'role'      => $user['role'],
        'avatar'    => $user['avatar'] ?? null,
        'google_id' => $user['google_id'] ?? $googleUser['google_id'] ?? null
    ],
    'is_new_user'    => $isNewUser,
    'needs_vehicle'  => $needsVehicle,
    'needs_phone'    => $needsPhone,
    'needs_profile_completion' => $needsVehicle || $needsPhone,
], $isNewUser ? 'Welcome! Account created successfully.' : 'Login successful');
