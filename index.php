<?php
/**
 * ANSSPA - Production Entry Point
 * Serves the built React app (index.html)
 */

$indexFile = __DIR__ . '/index.html';

if (file_exists($indexFile)) {
    // Serve the React SPA
    header('Content-Type: text/html; charset=utf-8');
    readfile($indexFile);
} else {
    // Build not found - show helpful setup message
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ANSSPA - Setup</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; }
            .icon { width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
            .icon svg { width: 32px; height: 32px; fill: white; }
            h1 { font-size: 24px; color: #1e293b; margin-bottom: 8px; }
            p { color: #64748b; line-height: 1.6; margin-bottom: 16px; }
            code { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 14px; color: #6366f1; }
            .steps { text-align: left; background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 20px; }
            .steps li { margin-bottom: 12px; color: #475569; font-size: 14px; }
            .steps code { display: block; margin-top: 4px; padding: 8px 12px; }
            a { color: #6366f1; text-decoration: none; }
            .api-ok { color: #22c55e; font-weight: bold; }
            .api-fail { color: #ef4444; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">
                <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H6v-2zm4 4h2v-2h-2v2zm4-4h2v2h-2v-2z"/></svg>
            </div>
            <h1>ANSSPA - Loyalty & Rewards</h1>
            <p>The React frontend has not been built yet.</p>

            <?php
            // Quick API health check
            try {
                require_once __DIR__ . '/api/config/database.php';
                $db = getDB();
                $stmt = $db->query("SELECT COUNT(*) FROM settings");
                $count = $stmt->fetchColumn();
                echo '<p>API Status: <span class="api-ok">✅ Connected</span> (' . $count . ' settings found)</p>';
            } catch (Exception $e) {
                echo '<p>API Status: <span class="api-fail">❌ Database error</span></p>';
            }
            ?>

            <ol class="steps">
                <li>
                    Install <a href="https://nodejs.org" target="_blank">Node.js</a> (v18+)
                </li>
                <li>
                    Install dependencies:
                    <code>cd frontend && npm install</code>
                </li>
                <li>
                    Development mode:
                    <code>npm run dev</code>
                </li>
                <li>
                    Production build:
                    <code>npm run build</code>
                </li>
            </ol>
        </div>
    </body>
    </html>
    <?php
}
