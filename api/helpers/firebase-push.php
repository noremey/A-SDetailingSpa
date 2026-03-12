<?php
/**
 * Firebase Cloud Messaging (FCM) v1 API Helper
 * Sends push notifications via FCM HTTP v1 API using service account credentials
 */

define('FCM_SERVICE_ACCOUNT_PATH', __DIR__ . '/../config/firebase-service-account.json');
define('FCM_TOKEN_CACHE_PATH', __DIR__ . '/../config/.fcm-token-cache.json');

/**
 * Get OAuth2 access token for FCM API using service account JWT
 * Caches token until expiry
 */
function getFcmAccessToken(): ?string {
    // Check cache
    if (file_exists(FCM_TOKEN_CACHE_PATH)) {
        $cache = json_decode(file_get_contents(FCM_TOKEN_CACHE_PATH), true);
        if ($cache && isset($cache['access_token'], $cache['expires_at'])) {
            if (time() < $cache['expires_at'] - 60) { // 60s buffer
                return $cache['access_token'];
            }
        }
    }

    // Load service account
    $sa = json_decode(file_get_contents(FCM_SERVICE_ACCOUNT_PATH), true);
    if (!$sa || !isset($sa['private_key'], $sa['client_email'], $sa['token_uri'])) {
        error_log('FCM: Invalid service account file');
        return null;
    }

    // Build JWT
    $now = time();
    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode([
        'iss' => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => $sa['token_uri'],
        'iat' => $now,
        'exp' => $now + 3600,
    ]));

    $signingInput = "$header.$payload";
    $signature = '';
    $key = openssl_pkey_get_private($sa['private_key']);
    if (!$key) {
        error_log('FCM: Failed to parse private key');
        return null;
    }
    openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256);
    $jwt = $signingInput . '.' . base64url_encode($signature);

    // Exchange JWT for access token
    $ch = curl_init($sa['token_uri']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        error_log("FCM: Token exchange failed (HTTP $httpCode): $response");
        return null;
    }

    $data = json_decode($response, true);
    if (!isset($data['access_token'])) {
        error_log('FCM: No access_token in response');
        return null;
    }

    // Cache token
    $cacheData = [
        'access_token' => $data['access_token'],
        'expires_at' => $now + ($data['expires_in'] ?? 3600),
    ];
    @file_put_contents(FCM_TOKEN_CACHE_PATH, json_encode($cacheData));

    return $data['access_token'];
}

/**
 * Send FCM notification to a single device token
 * @return int HTTP status code (200=success, 404=invalid token, 410=unregistered)
 */
function sendFcmNotification(string $fcmToken, string $title, string $body, string $url = '', string $icon = ''): int {
    $sa = json_decode(file_get_contents(FCM_SERVICE_ACCOUNT_PATH), true);
    $projectId = $sa['project_id'] ?? '';

    $accessToken = getFcmAccessToken();
    if (!$accessToken) {
        error_log('FCM: Could not get access token');
        return 500;
    }

    // Build FCM v1 message
    $message = [
        'message' => [
            'token' => $fcmToken,
            'notification' => [
                'title' => $title,
                'body' => $body,
            ],
            'webpush' => [
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                    'icon' => $icon ?: '/icons/icon-192.png',
                    'vibrate' => [100, 50, 100],
                    'requireInteraction' => false,
                ],
                'fcm_options' => [
                    'link' => $url ?: '/',
                ],
            ],
        ],
    ];

    $apiUrl = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
        CURLOPT_POSTFIELDS => json_encode($message),
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $err = json_decode($response, true);
        $errCode = $err['error']['details'][0]['errorCode'] ?? ($err['error']['status'] ?? 'UNKNOWN');
        error_log("FCM: Send failed (HTTP $httpCode, $errCode) for token: " . substr($fcmToken, 0, 20) . '...');

        // Map FCM errors to standard codes
        if (in_array($errCode, ['UNREGISTERED', 'NOT_FOUND', 'INVALID_ARGUMENT'])) {
            return 410; // Token invalid — should delete
        }
    }

    return $httpCode;
}

// base64url_encode() is defined in app.php — no duplicate needed here
