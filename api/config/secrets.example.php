<?php
/**
 * Secrets & Credentials
 * Copy this file to secrets.php and fill in your values
 */

define('JWT_SECRET', 'your_jwt_secret_here');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// Google OAuth — https://console.cloud.google.com/ > APIs & Services > Credentials
define('GOOGLE_CLIENT_ID', 'your_google_client_id.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', 'your_google_client_secret');

// Super admin emails - auto-promoted on Google login
define('SUPER_ADMIN_EMAILS', 'admin@example.com');
