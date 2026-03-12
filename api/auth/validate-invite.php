<?php
/**
 * Validate Staff Invite Code (Public endpoint)
 * GET ?code=XXXXX: Check if invite code is valid
 */
require_once __DIR__ . '/../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    apiResponse(false, null, 'Method not allowed', 405);
}

$code = sanitizeString($_GET['code'] ?? '');

if (empty($code) || strlen($code) < 10) {
    apiResponse(false, null, 'Invalid invite code');
}

$db = getDB();

// Auto-expire old invites first
$db->exec("UPDATE staff_invites SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()");

// Look up the invite
$stmt = $db->prepare("
    SELECT si.id, si.invite_code, si.status, si.expires_at, si.created_at,
           u.name AS invited_by
    FROM staff_invites si
    JOIN users u ON u.id = si.created_by
    WHERE si.invite_code = ?
    LIMIT 1
");
$stmt->execute([$code]);
$invite = $stmt->fetch();

if (!$invite) {
    apiResponse(false, null, 'Invalid invite code. Please check the link and try again.');
}

if ($invite['status'] === 'used') {
    apiResponse(false, null, 'This invite link has already been used.');
}

if ($invite['status'] === 'expired' || strtotime($invite['expires_at']) < time()) {
    apiResponse(false, null, 'This invite link has expired. Please request a new one from your administrator.');
}

apiResponse(true, [
    'invite' => [
        'valid'      => true,
        'expires_at' => $invite['expires_at'],
        'invited_by' => $invite['invited_by'],
    ]
], 'Invite code is valid');
