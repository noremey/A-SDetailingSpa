<?php
/**
 * Self-contained Web Push sender (no composer needed)
 * Implements VAPID authentication + RFC 8291 payload encryption
 * Requires PHP 7.3+ with openssl extension
 */

/**
 * Generate VAPID key pair (ECDSA P-256)
 * @return array ['publicKey' => base64url, 'privateKey' => PEM]
 */
function getOpensslConfig(): array {
    $paths = [
        'C:/xampp/apache/conf/openssl.cnf',
        'C:/xampp/php/extras/openssl/openssl.cnf',
        '/etc/ssl/openssl.cnf',
        '/etc/pki/tls/openssl.cnf',
        '/usr/lib/ssl/openssl.cnf',
        '/usr/local/etc/openssl/openssl.cnf',
    ];
    foreach ($paths as $p) {
        if (file_exists($p)) return ['config' => $p];
    }
    return [];
}

function generateVapidKeys(): array {
    $key = openssl_pkey_new(array_merge([
        'curve_name'       => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ], getOpensslConfig()));

    if (!$key) {
        throw new \RuntimeException('Failed to generate EC key: ' . openssl_error_string());
    }

    $details = openssl_pkey_get_details($key);
    $pubX = $details['ec']['x'];
    $pubY = $details['ec']['y'];

    // Uncompressed public key: 0x04 || x || y
    $publicKeyBinary = "\x04" . str_pad($pubX, 32, "\x00", STR_PAD_LEFT) . str_pad($pubY, 32, "\x00", STR_PAD_LEFT);
    $publicKeyBase64url = vapidBase64UrlEncode($publicKeyBinary);

    openssl_pkey_export($key, $privatePem, null, getOpensslConfig());

    return [
        'publicKey'  => $publicKeyBase64url,
        'privateKey' => $privatePem,
    ];
}

/**
 * Send a push notification to a subscription
 *
 * @param array  $subscription  ['endpoint' => url, 'p256dh' => base64url, 'auth' => base64url]
 * @param string $payload       JSON string to send
 * @param string $vapidPublicKey  Base64URL-encoded VAPID public key
 * @param string $vapidPrivatePem PEM-encoded VAPID private key
 * @param string $contactEmail    mailto: contact for VAPID
 * @return int HTTP status code (201=success, 410=gone, etc.)
 */
function sendPushNotification(
    array $subscription,
    string $payload,
    string $vapidPublicKey,
    string $vapidPrivatePem,
    string $contactEmail = ''
): int {
    $endpoint = $subscription['endpoint'];
    $userPublicKey = $subscription['p256dh'];
    $userAuthToken = $subscription['auth'];

    // ─── 1. Encrypt payload (RFC 8291 / aes128gcm) ───
    $encrypted = encryptPayload($payload, $userPublicKey, $userAuthToken);
    if (!$encrypted) {
        return 0;
    }

    // ─── 2. Create VAPID Authorization header ───
    $audience = parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST);
    $vapidHeaders = createVapidAuth($audience, $contactEmail, $vapidPublicKey, $vapidPrivatePem);
    if (!$vapidHeaders) {
        return 0;
    }

    // ─── 3. Send HTTP POST ───
    $headers = [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'Content-Length: ' . strlen($encrypted),
        'TTL: 86400',
        'Urgency: normal',
        'Authorization: ' . $vapidHeaders['authorization'],
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $encrypted,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode;
}

// ═══════════════════════════════════════════════════════
// VAPID Authentication
// ═══════════════════════════════════════════════════════

function createVapidAuth(
    string $audience,
    string $contactEmail,
    string $vapidPublicKey,
    string $vapidPrivatePem
): ?array {
    // Create JWT
    $header = vapidBase64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = vapidBase64UrlEncode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200, // 12 hours
        'sub' => $contactEmail ? "mailto:$contactEmail" : 'mailto:push@example.com',
    ]));

    $signingInput = "$header.$payload";

    // Sign with ES256 (ECDSA P-256 + SHA-256)
    $privateKey = openssl_pkey_get_private($vapidPrivatePem);
    if (!$privateKey) {
        return null;
    }

    $success = openssl_sign($signingInput, $derSignature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$success) {
        return null;
    }

    // Convert DER signature to raw r||s (64 bytes)
    $rawSignature = derToRaw($derSignature);
    $signature = vapidBase64UrlEncode($rawSignature);

    $jwt = "$header.$payload.$signature";

    return [
        'authorization' => "vapid t=$jwt, k=$vapidPublicKey",
    ];
}

// ═══════════════════════════════════════════════════════
// Payload Encryption (RFC 8291 - aes128gcm)
// ═══════════════════════════════════════════════════════

function encryptPayload(string $payload, string $userPublicKeyB64, string $userAuthB64): ?string {
    // Decode subscriber keys
    $userPublicKey = vapidBase64UrlDecode($userPublicKeyB64);
    $userAuth = vapidBase64UrlDecode($userAuthB64);

    if (strlen($userPublicKey) !== 65 || strlen($userAuth) !== 16) {
        return null;
    }

    // Generate ephemeral ECDH key pair
    $localKey = openssl_pkey_new(array_merge([
        'curve_name'       => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ], getOpensslConfig()));
    if (!$localKey) {
        return null;
    }

    $localDetails = openssl_pkey_get_details($localKey);
    $localPublicKey = "\x04"
        . str_pad($localDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($localDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    // ECDH shared secret
    $sharedSecret = computeECDH($localKey, $userPublicKey);
    if (!$sharedSecret) {
        return null;
    }

    // Generate 16-byte salt
    $salt = random_bytes(16);

    // ─── Key derivation (RFC 8291) ───

    // IKM = HKDF-SHA256(auth, sharedSecret, "WebPush: info\0" || userPub || localPub, 32)
    $authInfo = "WebPush: info\x00" . $userPublicKey . $localPublicKey;
    $ikm = hkdf($userAuth, $sharedSecret, $authInfo, 32);

    // PRK = HMAC-SHA256(salt, ikm)
    // Content Encryption Key = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
    $cekInfo = "Content-Encoding: aes128gcm\x00";
    $cek = hkdf($salt, $ikm, $cekInfo, 16);

    // Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
    $nonceInfo = "Content-Encoding: nonce\x00";
    $nonce = hkdf($salt, $ikm, $nonceInfo, 12);

    // ─── Encrypt with AES-128-GCM ───
    // Add padding delimiter (0x02 = final record)
    $paddedPayload = $payload . "\x02";

    $tag = '';
    $encrypted = openssl_encrypt(
        $paddedPayload,
        'aes-128-gcm',
        $cek,
        OPENSSL_RAW_DATA,
        $nonce,
        $tag,
        '',
        16
    );

    if ($encrypted === false) {
        return null;
    }

    // ─── Build aes128gcm content coding header ───
    // Header: salt (16) || rs (4) || idlen (1) || keyid (65)
    $rs = pack('N', 4096);
    $idLen = chr(65); // length of local public key
    $header = $salt . $rs . $idLen . $localPublicKey;

    return $header . $encrypted . $tag;
}

// ═══════════════════════════════════════════════════════
// Crypto Helpers
// ═══════════════════════════════════════════════════════

function computeECDH($localPrivKey, string $remotePubKeyBin): ?string {
    // Create an EVP_PKEY from the remote public key point
    // We need to build a proper public key PEM from the raw point
    $remotePem = rawPointToPem($remotePubKeyBin);
    if (!$remotePem) {
        return null;
    }

    $remotePubKey = openssl_pkey_get_public($remotePem);
    if (!$remotePubKey) {
        return null;
    }

    $sharedSecret = @openssl_pkey_derive($localPrivKey, $remotePubKey, 256);
    if ($sharedSecret === false) {
        return null;
    }

    return $sharedSecret;
}

function rawPointToPem(string $point): ?string {
    if (strlen($point) !== 65 || $point[0] !== "\x04") {
        return null;
    }

    // ASN.1 DER encoding for EC public key on P-256
    // SEQUENCE { SEQUENCE { OID ecPublicKey, OID prime256v1 }, BIT STRING { point } }
    $ecPublicKeyOid = "\x06\x07\x2a\x86\x48\xce\x3d\x02\x01"; // 1.2.840.10045.2.1
    $prime256v1Oid = "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07"; // 1.2.840.10045.3.1.7

    $algorithmIdentifier = "\x30" . chr(strlen($ecPublicKeyOid) + strlen($prime256v1Oid))
        . $ecPublicKeyOid . $prime256v1Oid;

    $bitString = "\x03" . chr(strlen($point) + 1) . "\x00" . $point;

    $der = "\x30" . chr(strlen($algorithmIdentifier) + strlen($bitString))
        . $algorithmIdentifier . $bitString;

    $pem = "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END PUBLIC KEY-----\n";

    return $pem;
}

function hkdf(string $salt, string $ikm, string $info, int $length): string {
    // Extract
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    // Expand (single block, length <= 32)
    return substr(hash_hmac('sha256', $info . "\x01", $prk, true), 0, $length);
}

function derToRaw(string $der): string {
    // Parse DER SEQUENCE containing two INTEGERs (r, s)
    $pos = 2; // skip SEQUENCE tag + length

    // Read r
    if ($der[$pos] !== "\x02") return $der;
    $pos++;
    $rLen = ord($der[$pos]);
    $pos++;
    $r = substr($der, $pos, $rLen);
    $pos += $rLen;

    // Read s
    if ($der[$pos] !== "\x02") return $der;
    $pos++;
    $sLen = ord($der[$pos]);
    $pos++;
    $s = substr($der, $pos, $sLen);

    // Pad/trim to 32 bytes each
    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);

    return $r . $s;
}

function vapidBase64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function vapidBase64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}
