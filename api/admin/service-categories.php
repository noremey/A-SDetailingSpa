<?php
/**
 * Admin Service Categories API
 * GET:  action=list   - List all categories (active only by default, or all with ?all=1)
 * POST: action=add    - Add a new category
 * POST: action=update - Update a category
 * POST: action=delete - Delete a category (sets services to uncategorized)
 * POST: action=reorder - Reorder categories
 */
require_once __DIR__ . '/../config/app.php';

$admin = requireAdmin();
$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $showAll = isset($_GET['all']) && $_GET['all'] === '1';

    if ($showAll) {
        $stmt = $db->query("
            SELECT c.*, COUNT(s.id) AS service_count
            FROM service_categories c
            LEFT JOIN services s ON s.category_id = c.id
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.id ASC
        ");
    } else {
        $stmt = $db->query("
            SELECT c.*, COUNT(s.id) AS service_count
            FROM service_categories c
            LEFT JOIN services s ON s.category_id = c.id AND s.status = 'active'
            WHERE c.status = 'active'
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.id ASC
        ");
    }

    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($categories as &$c) {
        $c['id'] = (int)$c['id'];
        $c['sort_order'] = (int)$c['sort_order'];
        $c['service_count'] = (int)$c['service_count'];
    }

    apiResponse(true, ['categories' => $categories]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    switch ($action) {
        case 'add':
            $name = sanitizeString($input['name'] ?? '');
            $color = sanitizeString($input['color'] ?? '#6366f1');
            if (empty($name)) {
                apiResponse(false, null, 'Category name is required');
            }
            // Validate hex color
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) $color = '#6366f1';

            $stmt = $db->query("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM service_categories");
            $nextOrder = (int)$stmt->fetchColumn();

            $stmt = $db->prepare("INSERT INTO service_categories (name, color, sort_order) VALUES (?, ?, ?)");
            $stmt->execute([$name, $color, $nextOrder]);

            $newId = (int)$db->lastInsertId();
            $stmt = $db->prepare("SELECT * FROM service_categories WHERE id = ?");
            $stmt->execute([$newId]);
            $category = $stmt->fetch(PDO::FETCH_ASSOC);
            $category['id'] = (int)$category['id'];
            $category['sort_order'] = (int)$category['sort_order'];
            $category['service_count'] = 0;

            apiResponse(true, ['category' => $category, 'message' => 'Category added']);
            break;

        case 'update':
            $id = (int)($input['id'] ?? 0);
            $name = sanitizeString($input['name'] ?? '');
            $status = ($input['status'] ?? 'active') === 'active' ? 'active' : 'inactive';
            $color = isset($input['color']) ? sanitizeString($input['color']) : null;

            if ($id <= 0 || empty($name)) {
                apiResponse(false, null, 'Invalid data');
            }

            if ($color !== null) {
                if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) $color = '#6366f1';
                $stmt = $db->prepare("UPDATE service_categories SET name = ?, status = ?, color = ? WHERE id = ?");
                $stmt->execute([$name, $status, $color, $id]);
            } else {
                $stmt = $db->prepare("UPDATE service_categories SET name = ?, status = ? WHERE id = ?");
                $stmt->execute([$name, $status, $id]);
            }

            apiResponse(true, ['message' => 'Category updated']);
            break;

        case 'delete':
            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                apiResponse(false, null, 'Invalid ID');
            }

            // Set services in this category to uncategorized
            $stmt = $db->prepare("UPDATE services SET category_id = NULL WHERE category_id = ?");
            $stmt->execute([$id]);

            $stmt = $db->prepare("DELETE FROM service_categories WHERE id = ?");
            $stmt->execute([$id]);

            apiResponse(true, ['message' => 'Category deleted']);
            break;

        case 'reorder':
            $order = $input['order'] ?? [];
            if (!is_array($order)) {
                apiResponse(false, null, 'Invalid order data');
            }

            $stmt = $db->prepare("UPDATE service_categories SET sort_order = ? WHERE id = ?");
            foreach ($order as $i => $id) {
                $stmt->execute([$i + 1, (int)$id]);
            }

            apiResponse(true, ['message' => 'Categories reordered']);
            break;

        default:
            apiResponse(false, null, 'Invalid action');
    }
} else {
    apiResponse(false, null, 'Method not allowed');
}
