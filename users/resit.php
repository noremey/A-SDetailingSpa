<?php
/**
 * Public Receipt Page
 * Shareable receipt URL — no login required
 * URL: resit.php?id={token_id}
 */
require_once __DIR__ . '/api/config.php';

$tokenId = intval($_GET['id'] ?? 0);
if (!$tokenId) { http_response_code(404); exit('Resit tidak dijumpai.'); }

$db = getDB();

// Fetch token + card + vehicle data
$stmt = $db->prepare("
    SELECT t.id, t.token_position, t.amount, t.notes, t.created_at,
           v.plate_number,
           lc.card_number, lc.tokens_earned, lc.tokens_required,
           u.name AS staff_name
    FROM tokens t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN loyalty_cards lc ON t.card_id = lc.id
    LEFT JOIN users u ON t.added_by = u.id
    WHERE t.id = ?
");
$stmt->execute([$tokenId]);
$token = $stmt->fetch();

if (!$token) { http_response_code(404); exit('Resit tidak dijumpai.'); }

// Fetch business settings
$settings = getSettings([
    'business_name', 'business_logo', 'business_address', 'business_phone',
    'primary_color', 'secondary_color', 'currency_symbol', 'reward_description'
]);

$bizName    = $settings['business_name'] ?? 'Business';
$bizAddr    = $settings['business_address'] ?? '';
$bizPhone   = $settings['business_phone'] ?? '';
$primary    = $settings['primary_color'] ?? '#6366f1';
$secondary  = $settings['secondary_color'] ?? '#8b5cf6';
$currency   = $settings['currency_symbol'] ?? 'RM';
$logoUrl    = !empty($settings['business_logo']) ? 'api/logo-proxy.php' : '';

$dt         = new DateTime($token['created_at'], new DateTimeZone('Asia/Kuala_Lumpur'));
$dateStr    = $dt->format('d M Y');
$timeStr    = $dt->format('g:i A');
$receiptNo  = 'TKN-' . $token['id'];
$amount     = $token['amount'] ? number_format((float)$token['amount'], 2) : null;
$earned     = (int)($token['tokens_earned'] ?? 0);
$required   = (int)($token['tokens_required'] ?? 10);
$pct        = $required > 0 ? min(round(($earned / $required) * 100), 100) : 0;
$remaining  = max(0, $required - $earned);

// Current URL for sharing
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$currentUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
?>
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resit <?= htmlspecialchars($receiptNo) ?> - <?= htmlspecialchars($bizName) ?></title>
    <meta name="description" content="Resit <?= htmlspecialchars($receiptNo) ?> dari <?= htmlspecialchars($bizName) ?>">
    <meta property="og:title" content="Resit <?= htmlspecialchars($receiptNo) ?> - <?= htmlspecialchars($bizName) ?>">
    <meta property="og:description" content="<?= $amount ? $currency . ' ' . $amount : 'Resit' ?> - <?= htmlspecialchars($bizName) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } }
        }
    </script>
    <style>
        body { background: linear-gradient(135deg, <?= $primary ?>10 0%, <?= $secondary ?>08 100%); min-height: 100vh; }
        .receipt-gradient { background: linear-gradient(135deg, <?= $primary ?>, <?= $secondary ?>); }
        .accent-color { color: <?= $primary ?>; }
        .accent-bg { background-color: <?= $primary ?>; }
        .accent-bg-soft { background-color: <?= $primary ?>0A; }
        .accent-border { border-color: <?= $primary ?>30; }
        @media print {
            body { background: white !important; padding: 0 !important; margin: 0 !important; }
            .no-print { display: none !important; }
            .receipt-card { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; page-break-inside: avoid; }
            .print-wrap { min-height: auto !important; padding: 0 !important; display: block !important; }
            .print-inner { max-width: 100% !important; width: 100% !important; }
        }
    </style>
</head>
<body class="font-sans antialiased">

<div class="print-wrap min-h-screen flex items-center justify-center p-4 sm:p-6">
    <div class="print-inner w-full max-w-sm">

        <!-- Close Button (top right, mobile + desktop) -->
        <button onclick="closeReceipt()" class="no-print fixed top-3 right-3 z-50 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white active:scale-95 transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>

        <!-- Receipt Card -->
        <div class="receipt-card bg-white rounded-3xl shadow-xl overflow-hidden">

            <!-- Gradient Header -->
            <div class="receipt-gradient px-6 pt-8 pb-6 text-center text-white relative overflow-hidden">
                <div class="absolute inset-0 opacity-10">
                    <div class="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full"></div>
                    <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-white rounded-full"></div>
                </div>
                <div class="relative z-10">
                    <?php if ($logoUrl): ?>
                    <img src="<?= $logoUrl ?>" alt="<?= htmlspecialchars($bizName) ?>"
                         class="w-16 h-16 object-contain mx-auto mb-3 rounded-2xl bg-white/20 p-1.5 backdrop-blur-sm">
                    <?php endif; ?>
                    <h1 class="font-extrabold text-lg tracking-tight"><?= htmlspecialchars($bizName) ?></h1>
                    <?php if ($bizAddr): ?>
                    <p class="text-white/70 text-xs mt-1 leading-relaxed"><?= htmlspecialchars($bizAddr) ?></p>
                    <?php endif; ?>
                    <?php if ($bizPhone): ?>
                    <p class="text-white/60 text-xs mt-0.5">Tel: <?= htmlspecialchars($bizPhone) ?></p>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Receipt Body -->
            <div class="px-6 py-6">

                <!-- Receipt Label -->
                <div class="flex items-center gap-3 mb-5">
                    <div class="flex-1 h-px bg-gray-200"></div>
                    <span class="text-[10px] font-bold text-gray-300 tracking-[0.2em] uppercase">Resit Transaksi</span>
                    <div class="flex-1 h-px bg-gray-200"></div>
                </div>

                <!-- Details -->
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">No. Resit</span>
                        <span class="text-xs font-bold text-gray-800"><?= $receiptNo ?></span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">Tarikh</span>
                        <span class="text-xs font-semibold text-gray-700"><?= $dateStr ?></span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">Masa</span>
                        <span class="text-xs font-semibold text-gray-700"><?= $timeStr ?></span>
                    </div>
                    <?php if ($token['staff_name']): ?>
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">Staff</span>
                        <span class="text-xs font-semibold text-gray-700"><?= htmlspecialchars($token['staff_name']) ?></span>
                    </div>
                    <?php endif; ?>
                </div>

                <!-- Amount -->
                <?php if ($amount): ?>
                <div class="mt-5 rounded-2xl p-5 text-center accent-bg-soft border accent-border">
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Jumlah</p>
                    <p class="text-3xl font-black text-gray-900"><?= $currency ?> <?= $amount ?></p>
                </div>
                <?php endif; ?>

                <!-- Service / Vehicle -->
                <?php if ($token['notes'] || $token['plate_number']): ?>
                <div class="mt-4 space-y-2.5">
                    <?php if ($token['notes']): ?>
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">Servis</span>
                        <span class="text-xs font-semibold text-gray-700"><?= htmlspecialchars($token['notes']) ?></span>
                    </div>
                    <?php endif; ?>
                    <?php if ($token['plate_number']): ?>
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-400">Kenderaan</span>
                        <span class="text-xs font-bold text-gray-800 tracking-wider"><?= htmlspecialchars($token['plate_number']) ?></span>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <!-- Loyalty Progress -->
                <div class="mt-5 bg-gray-50 rounded-2xl p-4">
                    <div class="flex items-center justify-between mb-2.5">
                        <span class="text-xs text-gray-500 font-semibold">Progres Kesetiaan</span>
                        <span class="text-xs font-extrabold accent-color"><?= $earned ?>/<?= $required ?></span>
                    </div>
                    <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full rounded-full accent-bg transition-all" style="width: <?= $pct ?>%;"></div>
                    </div>
                    <?php if ($earned < $required): ?>
                    <p class="text-[11px] text-gray-400 mt-2 text-center"><?= $remaining ?> lagi untuk ganjaran anda!</p>
                    <?php else: ?>
                    <p class="text-[11px] font-bold mt-2 text-center accent-color">Kad lengkap! Tebus ganjaran anda!</p>
                    <?php endif; ?>
                </div>

                <!-- Footer -->
                <div class="mt-6 text-center">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex-1 border-t border-dashed border-gray-200"></div>
                        <div class="w-2 h-2 rounded-full accent-bg opacity-30"></div>
                        <div class="flex-1 border-t border-dashed border-gray-200"></div>
                    </div>
                    <p class="text-sm font-bold text-gray-700">Terima kasih atas kunjungan anda!</p>
                    <p class="text-[11px] text-gray-400 mt-1"><?= htmlspecialchars($bizName) ?></p>
                    <p class="text-[10px] text-gray-300 mt-0.5"><?= $dateStr ?> <?= $timeStr ?></p>
                </div>
            </div>
        </div>

        <!-- Action Buttons (no-print) -->
        <div class="no-print mt-4 flex gap-2">
            <a href="https://api.whatsapp.com/send?text=<?= urlencode("🧾 Resit dari $bizName\n$receiptNo | $dateStr" . ($amount ? " | $currency $amount" : '') . "\n\n$currentUrl") ?>"
               target="_blank" rel="noopener"
               class="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
               style="background: #25D366;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
            </a>
            <button onclick="copyUrl()" id="copyUrlBtn"
               class="flex-1 py-3 rounded-xl text-sm font-semibold bg-white border-2 flex items-center justify-center gap-2 active:scale-[0.98] transition-all accent-border"
               style="color: <?= $primary ?>;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Salin URL</span>
            </button>
        </div>

        <!-- Close / Back Button -->
        <button onclick="closeReceipt()"
            class="no-print mt-3 w-full py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-gray-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            Tutup
        </button>

        <p class="no-print text-center text-[10px] text-gray-300 mt-4">Powered by Loyalty Rewards System</p>
    </div>
</div>

<script>
function closeReceipt() {
    // Try to close the tab/window
    window.close();
    // If window.close() doesn't work (not opened by script), go back or redirect
    setTimeout(function() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // Redirect to customer app
            window.location.href = window.location.pathname.replace('resit.php', '');
        }
    }, 300);
}

async function copyUrl() {
    const btn = document.getElementById('copyUrlBtn');
    const span = btn.querySelector('span');
    try {
        await navigator.clipboard.writeText(window.location.href);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = window.location.href;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
    span.textContent = 'Disalin! ✓';
    btn.style.background = '#22c55e'; btn.style.borderColor = '#22c55e'; btn.style.color = '#fff';
    setTimeout(() => {
        span.textContent = 'Salin URL';
        btn.style.background = '#fff'; btn.style.borderColor = ''; btn.style.color = '<?= $primary ?>';
    }, 2000);
}
</script>
</body>
</html>
