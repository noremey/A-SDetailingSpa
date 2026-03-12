<?php
/**
 * Admin Services API
 * GET:  action=list   - List all services (active only by default, or all with ?all=1)
 * POST: action=add    - Add a new service
 * POST: action=update - Update a service
 * POST: action=delete - Delete (deactivate) a service
 * POST: action=reorder - Reorder services
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $showAll = isset($_GET['all']) && $_GET['all'] === '1';

    if ($showAll) {
        $stmt = $db->query("
            SELECT s.*, c.name AS category_name, c.color AS category_color
            FROM services s
            LEFT JOIN service_categories c ON c.id = s.category_id
            ORDER BY c.sort_order ASC, s.sort_order ASC, s.id ASC
        ");
    } else {
        $stmt = $db->query("
            SELECT s.*, c.name AS category_name, c.color AS category_color
            FROM services s
            LEFT JOIN service_categories c ON c.id = s.category_id
            WHERE s.status = 'active'
            ORDER BY c.sort_order ASC, s.sort_order ASC, s.id ASC
        ");
    }

    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast types
    foreach ($services as &$s) {
        $s['id'] = (int)$s['id'];
        $s['category_id'] = $s['category_id'] ? (int)$s['category_id'] : null;
        $s['price'] = (float)$s['price'];
        $s['sort_order'] = (int)$s['sort_order'];
    }

    apiResponse(true, ['services' => $services]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    switch ($action) {
        case 'add':
            $name = sanitizeString($input['name'] ?? '');
            $price = (float)($input['price'] ?? 0);
            $categoryId = isset($input['category_id']) && $input['category_id'] ? (int)$input['category_id'] : null;

            if (empty($name) || $price <= 0) {
                apiResponse(false, null, 'Name and price are required');
            }

            // Get max sort_order
            $stmt = $db->query("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM services");
            $nextOrder = (int)$stmt->fetchColumn();

            $stmt = $db->prepare("INSERT INTO services (category_id, name, price, sort_order) VALUES (?, ?, ?, ?)");
            $stmt->execute([$categoryId, $name, $price, $nextOrder]);

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
            $categoryId = array_key_exists('category_id', $input)
                ? ($input['category_id'] ? (int)$input['category_id'] : null)
                : 'SKIP';

            if ($id <= 0 || empty($name) || $price <= 0) {
                apiResponse(false, null, 'Invalid data');
            }

            if ($categoryId === 'SKIP') {
                $stmt = $db->prepare("UPDATE services SET name = ?, price = ?, status = ? WHERE id = ?");
                $stmt->execute([$name, $price, $status, $id]);
            } else {
                $stmt = $db->prepare("UPDATE services SET name = ?, price = ?, status = ?, category_id = ? WHERE id = ?");
                $stmt->execute([$name, $price, $status, $categoryId, $id]);
            }

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
