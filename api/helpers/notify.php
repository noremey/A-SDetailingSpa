<?php
/**
 * Unified Notification Dispatcher
 * Sends Web Push notifications
 *
 * Usage: notifyUserAll($userId, 'Title', 'Body text', '/users/')
 */

require_once __DIR__ . '/send-push.php';

/**
 * Send notification to a user via Push
 *
 * @param int    $userId Target user ID
 * @param string $title  Notification title
 * @param string $body   Notification body
 * @param string $url    URL to open on push click (optional)
 */
function notifyUserAll(int $userId, string $title, string $body, string $url = '/users/'): void {
    try {
        notifyUser($userId, $title, $body, $url);
    } catch (\Exception $e) {
        // Silent
    }
}
