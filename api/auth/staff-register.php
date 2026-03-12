<?php
/**
 * Staff Self-Registration (Public endpoint - requires valid invite code)
 *
 * Two registration paths:
 * 1. Google: POST { invite_code, credential }
 * 2. Manual: POST { invite_code, name, phone, password, email? }
 *
 * - Validates invite code first
 * - Creates admin user
 * - Marks invite as used
 * - Does NOT return JWT (staff must login after registering)
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$input = getInput();
$inviteCode = sanitizeString($input['invite_code'] ?? '');

if (empty($inviteCode) || strlen($inviteCode) < 10) {
    apiResponse(false, null, 'Invalid invite code');
}

$db = getDB();

// Auto-expire old invites
$db->exec("UPDATE staff_invites SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()");

// Validate the invite code
$stmt = $db->prepare("
    SELECT id, invite_code, status, expires_at, created_by
    FROM staff_invites
    WHERE invite_code = ?
    LIMIT 1
");
$stmt->execute([$inviteCode]);
$invite = $stmt->fetch();

if (!$invite) {
    apiResponse(false, null, 'Invalid invite code');
}
if ($invite['status'] === 'used') {
    apiResponse(false, null, 'This invite link has already been used');
}
if ($invite['status'] === 'expired' || strtotime($invite['expires_at']) < time()) {
    apiResponse(false, null, 'This invite link has expired');
}

// Determine registration path
$isGoogle = !empty($input['credential']);

$db->beginTransaction();
try {
    if ($isGoogle) {
        // ============================
        // Google Registration
        // ============================
        $googleUser = verifyGoogleToken($input['credential']);
        if (!$googleUser || empty($googleUser['email'])) {
            apiResponse(false, null, 'Invalid Google token. Please try again.', 401);
        }

        $email = $googleUser['email'];
        $name  = $googleUser['name'];
        $googleId = $googleUser['google_id'];
        $avatar   = $googleUser['picture'] ?? null;

        // Check if user already exists
        $stmt = $db->prepare("SELECT id, role FROM users WHERE google_id = ? OR email = ? LIMIT 1");
        $stmt->execute([$googleId, $email]);
        $existing = $stmt->fetch();

        if ($existing) {
            $db->rollBack();
            if (in_array($existing['role'], ['admin', 'super_admin'])) {
                apiResponse(false, null, 'This Google account is already registered as staff. Please login instead.');
            } else {
                apiResponse(false, null, 'This Google account is already registered as a customer. Please contact admin.');
            }
        }

        // Create admin user
        $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $stmt = $db->prepare("SELECT id FROM users WHERE user_code = ?");
        $stmt->execute([$userCode]);
        while ($stmt->fetch()) {
            $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $stmt->execute([$userCode]);
        }

        $hashedPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);

        $stmt = $db->prepare("
            INSERT INTO users (user_code, name, phone, email, password, role, status, avatar, google_id)
            VALUES (?, ?, NULL, ?, ?, 'admin', 'active', ?, ?)
        ");
        $stmt->execute([$userCode, $name, $email, $hashedPassword, $avatar, $googleId]);
        $newUserId = (int)$db->lastInsertId();

    } else {
        // ============================
        // Manual Registration
        // ============================
        $name     = sanitizeString($input['name'] ?? '');
        $phone    = sanitizePhone($input['phone'] ?? '');
        $email    = sanitizeEmail($input['email'] ?? '');
        $password = $input['password'] ?? '';

        // Validation
        if (empty($name)) {
            $db->rollBack();
            apiResponse(false, null, 'Name is required');
        }
        if (empty($phone)) {
            $db->rollBack();
            apiResponse(false, null, 'Phone number is required');
        }
        if (strlen($phone) < 10) {
            $db->rollBack();
            apiResponse(false, null, 'Please enter a valid phone number (min 10 digits)');
        }
        if (strlen($password) < 6) {
            $db->rollBack();
            apiResponse(false, null, 'Password must be at least 6 characters');
        }

        // Check duplicate phone
        $stmt = $db->prepare("SELECT id FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetch()) {
            $db->rollBack();
            apiResponse(false, null, 'Phone number already registered');
        }

        // Check duplicate email if provided
        if (!empty($email)) {
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                $db->rollBack();
                apiResponse(false, null, 'Email already registered');
            }
        }

        // Create admin user
        $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $stmt = $db->prepare("SELECT id FROM users WHERE user_code = ?");
        $stmt->execute([$userCode]);
        while ($stmt->fetch()) {
            $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $stmt->execute([$userCode]);
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $db->prepare("
            INSERT INTO users (user_code, name, phone, email, password, role, status)
            VALUES (?, ?, ?, ?, ?, 'admin', 'active')
        ");
        $stmt->execute([$userCode, $name, $phone, $email ?: null, $hashedPassword]);
        $newUserId = (int)$db->lastInsertId();
    }

    // Mark invite as used
    $stmt = $db->prepare("UPDATE staff_invites SET status = 'used', used_by = ? WHERE id = ? AND status = 'active'");
    $stmt->execute([$newUserId, $invite['id']]);

    if ($stmt->rowCount() === 0) {
        // Race condition: invite was used between our check and now
        $db->rollBack();
        apiResponse(false, null, 'This invite link has already been used. Please request a new one.');
    }

    logActivity(
        $newUserId,
        'staff_self_registered',
        'user',
        $newUserId,
        "Staff self-registered: " . ($name ?? $googleUser['name'] ?? 'Unknown') . " via " . ($isGoogle ? 'Google' : 'manual form'),
        ['invite_id' => $invite['id'], 'method' => $isGoogle ? 'google' : 'manual']
    );

    $db->commit();

    apiResponse(true, [
        'user' => [
            'name'      => $isGoogle ? $googleUser['name'] : $name,
            'user_code' => $userCode,
        ]
    ], 'Registration successful! You can now login with your credentials.');

} catch (Exception $e) {
    $db->rollBack();
    apiResponse(false, null, 'Registration failed. Please try again.', 500);
}
