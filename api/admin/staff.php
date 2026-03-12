<?php
/**
 * Admin Staff Management (super_admin only)
 * GET action=list: List all staff (admin + super_admin)
 * GET action=search: Search staff by name/phone/email/code
 * DELETE action=delete: Delete a staff member (super_admin only)
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

$method = $_SERVER['REQUEST_METHOD'];

// Admin staff can view (GET), only super_admin can modify (POST)
if ($method !== 'GET' && $admin['role'] !== 'super_admin') {
    apiResponse(false, null, 'Super admin access required', 403);
}

if ($method === 'GET') {
    $action = sanitizeString($_GET['action'] ?? 'list');

    switch ($action) {
        case 'search':
            $q = sanitizeString($_GET['q'] ?? '');
            if (strlen($q) < 1) {
                apiResponse(false, null, 'Search query is required');
            }

            $searchTerm = "%$q%";
            $stmt = $db->prepare("
                SELECT id, user_code, name, phone, email, avatar, google_id, role, status, last_login, created_at
                FROM users
                WHERE role IN ('admin', 'staff', 'super_admin')
                  AND (user_code LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)
                ORDER BY
                    CASE role WHEN 'super_admin' THEN 0 ELSE 1 END,
                    name ASC
                LIMIT 20
            ");
            $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
            $staff = $stmt->fetchAll();

            foreach ($staff as &$s) {
                $s['id'] = (int)$s['id'];
                $s['is_google'] = !empty($s['google_id']);
            }

            apiResponse(true, ['staff' => $staff]);
            break;

        case 'list':
        default:
            $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
            $limit  = min(50, max(5, sanitizeInt($_GET['limit'] ?? 10)));
            $offset = ($page - 1) * $limit;

            // Total count of staff
            $stmt = $db->query("SELECT COUNT(*) FROM users WHERE role IN ('admin', 'staff', 'super_admin')");
            $total = (int)$stmt->fetchColumn();

            $stmt = $db->prepare("
                SELECT id, user_code, name, phone, email, avatar, google_id, role, status, last_login, created_at
                FROM users
                WHERE role IN ('admin', 'staff', 'super_admin')
                ORDER BY
                    CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                    created_at DESC
                LIMIT $limit OFFSET $offset
            ");
            $stmt->execute();
            $staff = $stmt->fetchAll();

            foreach ($staff as &$s) {
                $s['id'] = (int)$s['id'];
                $s['is_google'] = !empty($s['google_id']);
            }

            apiResponse(true, [
                'staff' => $staff,
                'total' => $total,
                'page'  => $page,
                'pages' => (int)ceil($total / $limit)
            ]);
            break;
    }

} elseif ($method === 'POST') {
    $input = getInput();
    $action = sanitizeString($input['action'] ?? '');

    switch ($action) {
        case 'add':
            $name     = sanitizeString($input['name'] ?? '');
            $phone    = sanitizePhone($input['phone'] ?? '');
            $email    = sanitizeEmail($input['email'] ?? '');
            $password = $input['password'] ?? '';
            $role     = sanitizeString($input['role'] ?? 'admin');

            // Validation
            if (empty($name)) {
                apiResponse(false, null, 'Name is required');
            }
            if (empty($phone)) {
                apiResponse(false, null, 'Phone number is required');
            }
            if (strlen($phone) < 10) {
                apiResponse(false, null, 'Please enter a valid phone number (min 10 digits)');
            }
            if (strlen($password) < 6) {
                apiResponse(false, null, 'Password must be at least 6 characters');
            }
            if (!in_array($role, ['admin', 'staff'])) {
                apiResponse(false, null, 'Invalid role. Only admin or staff role can be created.');
            }

            // Check duplicate phone
            $stmt = $db->prepare("SELECT id FROM users WHERE phone = ?");
            $stmt->execute([$phone]);
            if ($stmt->fetch()) {
                apiResponse(false, null, 'Phone number already registered');
            }

            // Check duplicate email if provided
            if (!empty($email)) {
                $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                if ($stmt->fetch()) {
                    apiResponse(false, null, 'Email already registered');
                }
            }

            $db->beginTransaction();
            try {
                $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);

                // Ensure unique user_code
                $stmt = $db->prepare("SELECT id FROM users WHERE user_code = ?");
                $stmt->execute([$userCode]);
                while ($stmt->fetch()) {
                    $userCode = 'STAFF-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
                    $stmt->execute([$userCode]);
                }

                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

                $stmt = $db->prepare("
                    INSERT INTO users (user_code, name, phone, email, password, role, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                ");
                $stmt->execute([$userCode, $name, $phone, $email ?: null, $hashedPassword, $role]);
                $newStaffId = (int)$db->lastInsertId();

                logActivity(
                    $admin['user_id'],
                    'staff_created',
                    'user',
                    $newStaffId,
                    "Created staff: $name ($email) as $role",
                    ['new_user_code' => $userCode, 'role' => $role]
                );

                $db->commit();

                apiResponse(true, [
                    'staff' => [
                        'id'        => $newStaffId,
                        'user_code' => $userCode,
                        'name'      => $name,
                        'phone'     => $phone,
                        'email'     => $email,
                        'role'      => $role,
                        'status'    => 'active'
                    ]
                ], "Staff member '$name' has been created successfully");

            } catch (Exception $e) {
                $db->rollBack();
                apiResponse(false, null, 'Failed to create staff member. Please try again.', 500);
            }
            break;

        case 'create_invite':
            $db->beginTransaction();
            try {
                // Generate unique invite code (128-bit entropy)
                $inviteCode = bin2hex(random_bytes(16));

                // Ensure unique
                $stmt = $db->prepare("SELECT id FROM staff_invites WHERE invite_code = ?");
                $stmt->execute([$inviteCode]);
                while ($stmt->fetch()) {
                    $inviteCode = bin2hex(random_bytes(16));
                    $stmt->execute([$inviteCode]);
                }

                // Expires in 48 hours
                $expiresAt = date('Y-m-d H:i:s', strtotime('+48 hours'));

                $stmt = $db->prepare("
                    INSERT INTO staff_invites (invite_code, created_by, status, expires_at)
                    VALUES (?, ?, 'active', ?)
                ");
                $stmt->execute([$inviteCode, $admin['user_id'], $expiresAt]);

                logActivity(
                    $admin['user_id'],
                    'staff_invite_created',
                    'staff_invite',
                    (int)$db->lastInsertId(),
                    'Generated staff invite link',
                    ['invite_code' => substr($inviteCode, 0, 8) . '...']
                );

                $db->commit();

                apiResponse(true, [
                    'invite' => [
                        'code'       => $inviteCode,
                        'expires_at' => $expiresAt,
                    ]
                ], 'Invite link created successfully');

            } catch (Exception $e) {
                $db->rollBack();
                apiResponse(false, null, 'Failed to create invite link. Please try again.', 500);
            }
            break;

        case 'change_role':
            // Only super_admin can change roles
            if ($admin['role'] !== 'super_admin') {
                apiResponse(false, null, 'Only super admin can change roles', 403);
            }

            $staffId = sanitizeInt($input['staff_id'] ?? 0);
            $newRole = sanitizeString($input['role'] ?? '');

            if ($staffId <= 0) {
                apiResponse(false, null, 'Staff ID is required');
            }
            if (!in_array($newRole, ['admin', 'super_admin'])) {
                apiResponse(false, null, 'Invalid role. Allowed: admin, super_admin');
            }

            // Cannot change own role
            if ($staffId == $admin['user_id']) {
                apiResponse(false, null, 'You cannot change your own role');
            }

            // Check staff exists
            $stmt = $db->prepare("SELECT id, name, role, email FROM users WHERE id = ? AND role IN ('admin', 'staff', 'super_admin')");
            $stmt->execute([$staffId]);
            $targetStaff = $stmt->fetch();

            if (!$targetStaff) {
                apiResponse(false, null, 'Staff member not found', 404);
            }

            // Same role check
            if ($targetStaff['role'] === $newRole) {
                apiResponse(false, null, "Already has '{$newRole}' role");
            }

            // Update role
            $stmt = $db->prepare("UPDATE users SET role = ? WHERE id = ?");
            $stmt->execute([$newRole, $staffId]);

            $oldRole = $targetStaff['role'];
            $roleName = $newRole === 'super_admin' ? 'Super Admin' : 'Admin';

            logActivity(
                $admin['user_id'],
                'staff_role_changed',
                'user',
                $staffId,
                "Changed {$targetStaff['name']} role from {$oldRole} to {$newRole}",
                ['old_role' => $oldRole, 'new_role' => $newRole]
            );

            apiResponse(true, [
                'staff' => [
                    'id'   => (int)$staffId,
                    'name' => $targetStaff['name'],
                    'role' => $newRole,
                ]
            ], "{$targetStaff['name']} is now {$roleName}");
            break;

        case 'update_password':
            $staffId     = sanitizeInt($input['staff_id'] ?? 0);
            $newPassword = $input['new_password'] ?? '';

            if ($staffId <= 0) {
                apiResponse(false, null, 'Staff ID is required');
            }
            if (strlen($newPassword) < 6) {
                apiResponse(false, null, 'Password must be at least 6 characters');
            }

            // Check staff exists
            $stmt = $db->prepare("SELECT id, name, role FROM users WHERE id = ? AND role IN ('admin', 'staff', 'super_admin')");
            $stmt->execute([$staffId]);
            $targetStaff = $stmt->fetch();

            if (!$targetStaff) {
                apiResponse(false, null, 'Staff member not found', 404);
            }

            // Only super_admin can change other super_admin's password
            if ($targetStaff['role'] === 'super_admin' && $admin['user_id'] != $staffId) {
                apiResponse(false, null, 'Cannot change another super admin\'s password');
            }

            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
            $stmt->execute([$hashedPassword, $staffId]);

            $isSelf = $staffId == $admin['user_id'];
            logActivity(
                $admin['user_id'],
                'staff_password_changed',
                'user',
                $staffId,
                $isSelf
                    ? "Changed own password"
                    : "Changed password for {$targetStaff['name']}",
                ['target_user' => $targetStaff['name'], 'target_role' => $targetStaff['role']]
            );

            apiResponse(true, null, $isSelf
                ? 'Your password has been updated successfully'
                : "Password for {$targetStaff['name']} has been updated successfully"
            );
            break;

        case 'delete':
            $staffId = sanitizeInt($input['staff_id'] ?? 0);
            if ($staffId <= 0) {
                apiResponse(false, null, 'Staff ID is required');
            }

            // Cannot delete yourself
            if ($staffId == $admin['user_id']) {
                apiResponse(false, null, 'You cannot delete your own account');
            }

            // Check staff exists and is admin role
            $stmt = $db->prepare("SELECT id, name, role, email FROM users WHERE id = ? AND role IN ('admin', 'staff', 'super_admin')");
            $stmt->execute([$staffId]);
            $staff = $stmt->fetch();

            if (!$staff) {
                apiResponse(false, null, 'Staff member not found', 404);
            }

            // Cannot delete other super_admins (safety)
            if ($staff['role'] === 'super_admin') {
                apiResponse(false, null, 'Cannot delete a super admin account');
            }

            // Delete the staff member
            $stmt = $db->prepare("DELETE FROM users WHERE id = ? AND role IN ('admin', 'staff')");
            $stmt->execute([$staffId]);

            if ($stmt->rowCount() > 0) {
                logActivity(
                    $admin['user_id'],
                    'staff_deleted',
                    'user',
                    $staffId,
                    "Deleted staff: {$staff['name']} ({$staff['email']})",
                    ['deleted_user' => $staff['name'], 'deleted_role' => $staff['role']]
                );

                apiResponse(true, null, "Staff member '{$staff['name']}' has been deleted");
            } else {
                apiResponse(false, null, 'Failed to delete staff member');
            }
            break;

        default:
            apiResponse(false, null, 'Invalid action');
    }

} else {
    apiResponse(false, null, 'Method not allowed', 405);
}
