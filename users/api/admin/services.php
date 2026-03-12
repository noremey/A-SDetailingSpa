<?php
/**
 * Admin Services API (Menu Items)
 * GET:  action=list   - List all active services
 * POST: action=add    - Add a new service
 * POST: action=update - Update a service
 * POST: action=delete - Delete a service
 * POST: action=reorder - Reorder services
 */
require_once __DIR__ . '/../staff-config.php';

$admin = requireAdmin();
$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $showAll = isset($_GET['all']) && $_GET['all'] === '1';

    if ($showAll) {
        $stmt = $db->query("SELECT * FROM services ORDER BY sort_order ASC, id ASC");
    } else {
        $stmt = $db->query("SELECT * FROM services WHERE status = 'active' ORDER BY sort_order ASC, id ASC");
    }

    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast types
    foreach ($services as &$s) {
        $s['id'] = (int)$s['id'];
        $s['price'] = (float)$s['price'];
        $s['sort_order'] = (int)$s['sort_order'];
    }

    apiResponse(true, ['services' => $services]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getInput();
    $action = $input['action'] ?? '';

    switch ($action) {
        case 'add':
            $name = sanitizeString($input['name'] ?? '');
            $price = (float)($input['price'] ?? 0);

            if (empty($name) || $price <= 0) {
                apiResponse(false, null, 'Name and price are required');
            }

            $stmt = $db->query("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM services");
            $nextOrder = (int)$stmt->fetchColumn();

            $stmt = $db->prepare("INSERT INTO services (name, price, sort_order) VALUES (?, ?, ?)");
            $stmt->execute([$name, $price, $nextOrder]);

            $newId = (int)$db->lastInsertId();
            $stmt = $db->prepare("SELECT * FROM services WHERE id = ?");
            $stmt->execute([$newId]);
            $service = $stmt->fetch(PDO::FETCH_ASSOC);
            $service['id'] = (int)$service['id'];
            $service['price'] = (float)$service['price'];
            $service['sort_order'] = (int)$service['sort_order'];

            apiResponse(true, ['service' => $service, 'message' => 'Service added']);
            break;

        case 'update':
            $id = (int)($input['id'] ?? 0);
            $name = sanitizeString($input['name'] ?? '');
            $price = (float)($input['price'] ?? 0);
            $status = ($input['status'] ?? 'active') === 'active' ? 'active' : 'inactive';

            if ($id <= 0 || empty($name) || $price <= 0) {
                apiResponse(false, null, 'Invalid data');
            }

            $stmt = $db->prepare("UPDATE services SET name = ?, price = ?, status = ? WHERE id = ?");
            $stmt->execute([$name, $price, $status, $id]);

            apiResponse(true, ['message' => 'Service updated']);
            break;

        case 'delete':
            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                apiResponse(false, null, 'Invalid ID');
            }

            $stmt = $db->prepare("DELETE FROM services WHERE id = ?");
            $stmt->execute([$id]);

            apiResponse(true, ['message' => 'Service deleted']);
            break;

        case 'reorder':
            $order = $input['order'] ?? [];
            if (!is_array($order)) {
                apiResponse(false, null, 'Invalid order data');
            }

            $stmt = $db->prepare("UPDATE services SET sort_order = ? WHERE id = ?");
            foreach ($order as $i => $id) {
                $stmt->execute([$i + 1, (int)$id]);
            }

            apiResponse(true, ['message' => 'Services reordered']);
            break;

        default:
            apiResponse(false, null, 'Invalid action');
    }
} else {
    apiResponse(false, null, 'Method not allowed');
}
