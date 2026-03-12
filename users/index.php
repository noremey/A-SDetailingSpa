<?php
session_start();
$isLoggedIn = !empty($_SESSION['user_id']);
?>
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#3b82f6">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="ANSSPA Rewards">
    <title>ANSSPA Rewards</title>
    <link rel="manifest" href="manifest.php">
    <link rel="icon" type="image/png" href="api/logo-proxy.php">
    <link rel="apple-touch-icon" sizes="180x180" href="api/logo-proxy.php">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
                }
            }
        }
    </script>
    <style>
        :root {
            --primary: #6366f1;
            --secondary: #8b5cf6;
        }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #f1f5f9; -webkit-font-smoothing: antialiased; }

        /* ===== Scrollbar ===== */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        /* ===== Loyalty Card ===== */
        .loyalty-card {
            border-radius: 1.25rem;
            overflow: hidden;
            position: relative;
        }
        .loyalty-card::before {
            content: '';
            position: absolute;
            top: -40%; right: -20%;
            width: 300px; height: 300px;
            background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
            border-radius: 50%;
        }
        .loyalty-card::after {
            content: '';
            position: absolute;
            bottom: -30%; left: -15%;
            width: 250px; height: 250px;
            background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
            border-radius: 50%;
        }
        .loyalty-card > * { position: relative; z-index: 1; }

        /* ===== Token Circle ===== */
        .token-circle {
            width: 44px; height: 44px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 12px;
            border: 2px solid;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            position: relative;
        }
        @media (min-width: 640px) { .token-circle { width: 48px; height: 48px; font-size: 13px; } }
        @media (min-width: 768px) { .token-circle { width: 56px; height: 56px; font-size: 14px; } }

        .token-filled {
            background: rgba(255,255,255,0.3);
            border-color: white;
            box-shadow: 0 4px 12px rgba(255,255,255,0.2);
        }
        .token-empty {
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.25);
            border-style: dashed;
        }
        .token-latest {
            ring: 2px;
            box-shadow: 0 0 0 3px rgba(253, 224, 71, 0.6), 0 4px 12px rgba(255,255,255,0.2);
        }

        /* ===== Token pulse animation ===== */
        @keyframes tokenPulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(253,224,71,0.6), 0 0 0 0 rgba(253,224,71,0.4); }
            50% { box-shadow: 0 0 0 3px rgba(253,224,71,0.6), 0 0 15px 0 rgba(253,224,71,0.3); }
        }
        .token-latest { animation: tokenPulse 2s ease-in-out infinite; }

        /* ===== Token entry animation ===== */
        @keyframes tokenEntry {
            from { transform: scale(0) rotate(-180deg); opacity: 0; }
            to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .token-animate {
            animation: tokenEntry 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            opacity: 0;
        }

        /* ===== Progress bar fill ===== */
        @keyframes progressFill { from { width: 0; } }
        .progress-fill { animation: progressFill 1s ease-out 0.3s forwards; }

        /* ===== Status pulse ===== */
        @keyframes statusPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .status-pulse { animation: statusPulse 2s ease-in-out infinite; }

        /* ===== Page transition ===== */
        @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeSlideIn 0.35s ease-out; }

        /* ===== Modal slide ===== */
        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        .slide-up { animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1); }

        /* ===== Toast ===== */
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* ===== Loader ===== */
        .loader {
            width: 40px; height: 40px;
            border: 3px solid #e2e8f0;
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ===== Status badges ===== */
        .badge-active { background: #dbeafe; color: #1d4ed8; }
        .badge-completed { background: #fef3c7; color: #d97706; }
        .badge-redeemed { background: #d1fae5; color: #059669; }

        /* ===== Input focus ===== */
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        /* ===== Token Tooltip ===== */
        .token-tip {
            position: relative;
        }
        .token-tip .tip-box {
            visibility: hidden;
            opacity: 0;
            position: absolute;
            bottom: calc(100% + 10px);
            left: 50%;
            transform: translateX(-50%) translateY(4px);
            background: #1e293b;
            color: #fff;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 11px;
            line-height: 1.5;
            white-space: nowrap;
            z-index: 100;
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s, visibility 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .token-tip .tip-box::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #1e293b;
        }
        .token-tip:hover .tip-box {
            visibility: visible;
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        /* Edge protection - keep tooltip on screen */
        .token-tip:first-child .tip-box { left: 0; transform: translateX(0) translateY(4px); }
        .token-tip:first-child:hover .tip-box { transform: translateX(0) translateY(0); }
        .token-tip:first-child .tip-box::after { left: 16px; transform: none; }
        .token-tip:last-child .tip-box { left: auto; right: 0; transform: translateX(0) translateY(4px); }
        .token-tip:last-child:hover .tip-box { transform: translateX(0) translateY(0); }
        .token-tip:last-child .tip-box::after { left: auto; right: 16px; transform: none; }

        /* Mini token tooltip (history) */
        .mini-tip {
            position: relative;
        }
        .mini-tip .tip-box {
            visibility: hidden;
            opacity: 0;
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%) translateY(4px);
            background: #1e293b;
            color: #fff;
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 10px;
            line-height: 1.4;
            white-space: nowrap;
            z-index: 100;
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s, visibility 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .mini-tip .tip-box::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: #1e293b;
        }
        .mini-tip:hover .tip-box {
            visibility: visible;
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        /* ===== Bottom nav safe area ===== */
        .bottom-nav {
            padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }

        /* ===== Custom scrollbar hide for token row ===== */
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        /* ===== Vehicle type selector ===== */
        .vtype-active, .rvtype-active {
            border-color: var(--primary) !important;
            color: var(--primary) !important;
            background: color-mix(in srgb, var(--primary) 6%, transparent);
        }

        /* ===== Nav active state ===== */
        .nav-active { color: var(--primary); }
        .nav-active svg { stroke: var(--primary); }
    </style>
</head>
<body class="min-h-screen">

<!-- ==================== LOGIN SCREEN ==================== -->
<div id="loginScreen" class="min-h-screen flex flex-col items-center justify-center px-5 <?= $isLoggedIn ? 'hidden' : '' ?>">
    <div class="w-full max-w-sm">
        <!-- Logo + Header -->
        <div class="text-center mb-8">
            <div id="loginLogo" class="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl overflow-hidden"
                 style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
            </div>
            <h1 id="loginTitle" class="text-2xl font-extrabold text-gray-900">Loyalty Card</h1>
            <p class="text-gray-400 mt-2 text-sm">Masukkan nombor telefon untuk log masuk</p>
        </div>

        <!-- Login Form -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Nombor Telefon</label>
            <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </span>
                <input type="tel" id="phoneInput" placeholder="cth: 0121234567"
                    class="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl text-base transition" maxlength="15">
            </div>
            <button id="loginBtn" onclick="doLogin()"
                class="w-full mt-4 py-3.5 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50"
                style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                Log Masuk
            </button>
        </div>

        <p class="text-center text-xs text-gray-400 mt-6">Pengguna baru akan diminta untuk mendaftar</p>
    </div>
</div>


<!-- ==================== REGISTRATION SCREEN ==================== -->
<div id="registerScreen" class="min-h-screen px-5 py-8 hidden">
    <div class="w-full max-w-md mx-auto">

        <!-- Back button + Header -->
        <div class="mb-6">
            <button onclick="backToLogin()" class="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                <span class="text-sm font-medium">Kembali</span>
            </button>
            <div class="flex items-center gap-4">
                <div id="regLogo" class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden"
                     style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                </div>
                <div>
                    <h1 class="text-2xl font-extrabold text-gray-900">Daftar Akaun</h1>
                    <p class="text-sm text-gray-400 mt-0.5">Lengkapkan maklumat anda</p>
                </div>
            </div>
        </div>

        <!-- Progress Steps -->
        <div class="flex items-center gap-2 mb-6">
            <div id="step1Dot" class="flex items-center gap-2 flex-1">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style="background: var(--primary);">1</div>
                <div id="step1Bar" class="flex-1 h-1 rounded-full" style="background: var(--primary);"></div>
            </div>
            <div id="step2Dot" class="flex items-center gap-2 flex-1">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold" id="step2Circle">2</div>
                <div class="flex-1 h-1 rounded-full bg-gray-200" id="step2Bar"></div>
            </div>
            <div id="step3Dot">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold" id="step3Circle">3</div>
            </div>
        </div>

        <!-- Step 1: Personal Info -->
        <div id="regStep1" class="fade-in">
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div class="flex items-center gap-2.5 mb-5">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: color-mix(in srgb, var(--primary) 12%, transparent);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">Maklumat Peribadi</h3>
                        <p id="step1Label" class="text-xs text-gray-400">Langkah 1 daripada 3</p>
                    </div>
                </div>

                <!-- Phone (readonly) -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Nombor Telefon</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </span>
                        <input type="tel" id="regPhone" class="w-full pl-11 pr-4 py-3 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed" readonly>
                        <span class="absolute right-4 top-1/2 -translate-y-1/2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                    </div>
                </div>

                <!-- Name -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                        Nama Penuh <span class="text-red-400">*</span>
                    </label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </span>
                        <input type="text" id="regName" placeholder="Masukkan nama penuh anda"
                            class="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm transition">
                    </div>
                    <p id="regNameErr" class="text-xs text-red-400 mt-1 hidden"></p>
                </div>

                <!-- Email -->
                <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                        Email <span class="text-gray-300 text-[10px] font-normal normal-case">(pilihan)</span>
                    </label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </span>
                        <input type="email" id="regEmail" placeholder="contoh@email.com"
                            class="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm transition">
                    </div>
                </div>
            </div>

            <button onclick="goToStep2()"
                class="w-full mt-4 py-3.5 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg hover:shadow-xl"
                style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                Seterusnya
                <svg class="inline-block ml-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>

        <!-- Step 2: Vehicle Info -->
        <div id="regStep2" class="fade-in hidden">
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div class="flex items-center gap-2.5 mb-5">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">Maklumat Kenderaan</h3>
                        <p id="step2Label" class="text-xs text-gray-400">Langkah 2 daripada 3</p>
                    </div>
                </div>

                <!-- Plate Number -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                        Nombor Plat <span class="text-red-400">*</span>
                    </label>
                    <input type="text" id="regPlate" placeholder="cth: WA 1234 A"
                        class="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm uppercase tracking-wider text-center font-bold text-gray-800 transition">
                    <p id="regPlateErr" class="text-xs text-red-400 mt-1 hidden"></p>
                </div>

                <!-- Vehicle Type -->
                <div class="mb-4">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Jenis Kenderaan</label>
                    <div class="grid grid-cols-2 gap-2" id="regVehicleTypeSelector">
                        <button type="button" onclick="selectRegVehicleType('car')" class="rvtype-btn rvtype-active py-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                            Kereta
                        </button>
                        <button type="button" onclick="selectRegVehicleType('motorcycle')" class="rvtype-btn py-3 rounded-xl border-2 border-gray-200 text-gray-400 text-sm font-semibold transition flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17h7M5 14l4-7h4l3 7"/></svg>
                            Motosikal
                        </button>
                    </div>
                    <input type="hidden" id="regVehicleType" value="car">
                </div>

                <!-- Vehicle Model -->
                <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                        Model <span class="text-gray-300 text-[10px] font-normal normal-case">(pilihan)</span>
                    </label>
                    <input type="text" id="regVehicleModel" placeholder="cth: Perodua Myvi"
                        class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm transition">
                </div>
            </div>

            <div class="flex gap-3 mt-4">
                <button onclick="goToStep1()"
                    class="flex-1 py-3.5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:bg-gray-50">
                    <svg class="inline-block mr-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Kembali
                </button>
                <button onclick="goToStep3()"
                    class="flex-[2] py-3.5 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg hover:shadow-xl"
                    style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                    Seterusnya
                    <svg class="inline-block ml-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
        </div>

        <!-- Step 3: Confirm -->
        <div id="regStep3" class="fade-in hidden">
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div class="flex items-center gap-2.5 mb-5">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">Pengesahan</h3>
                        <p id="step3Label" class="text-xs text-gray-400">Langkah 3 daripada 3</p>
                    </div>
                </div>

                <p class="text-sm text-gray-500 mb-4">Sila semak maklumat sebelum mendaftar:</p>

                <div class="space-y-3">
                    <!-- Summary: Phone -->
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div class="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Telefon</p>
                            <p id="confirmPhone" class="text-sm font-bold text-gray-800"></p>
                        </div>
                    </div>
                    <!-- Summary: Name -->
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div class="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Nama</p>
                            <p id="confirmName" class="text-sm font-bold text-gray-800"></p>
                        </div>
                    </div>
                    <!-- Summary: Email -->
                    <div id="confirmEmailRow" class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hidden">
                        <div class="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Email</p>
                            <p id="confirmEmail" class="text-sm font-bold text-gray-800"></p>
                        </div>
                    </div>
                    <!-- Summary: Vehicle -->
                    <div id="confirmVehicleRow" class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div class="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Kenderaan</p>
                            <p id="confirmVehicle" class="text-sm font-bold text-gray-800"></p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-3 mt-4">
                <button onclick="goToStep2FromConfirm()"
                    class="flex-1 py-3.5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 transition-all active:scale-[0.98] hover:bg-gray-50">
                    <svg class="inline-block mr-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Edit
                </button>
                <button onclick="submitRegistration()" id="regSubmitBtn"
                    class="flex-[2] py-3.5 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg hover:shadow-xl"
                    style="background: linear-gradient(135deg, #059669, #10b981);">
                    <svg class="inline-block mr-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Daftar Sekarang
                </button>
            </div>
        </div>

    </div>
</div>


<!-- ==================== MAIN APP ==================== -->
<div id="appScreen" class="min-h-screen pb-24 md:pb-28 <?= $isLoggedIn ? '' : 'hidden' ?>">
    <div class="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-5xl">

        <!-- ===== MY CARD TAB ===== -->
        <div id="tab-card" class="tab-panel px-4 md:px-6 lg:px-8 pt-4 md:pt-6">

            <!-- Header -->
            <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-3">
                    <div id="headerAvatar" class="w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                         style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                        ?
                    </div>
                    <div>
                        <p class="text-base md:text-lg font-bold text-gray-900">Hi, <span id="headerName">-</span>!</p>
                        <p id="headerCode" class="text-xs text-gray-400 font-mono"></p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="loadCard()" id="refreshBtn" class="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                </div>
            </div>

            <!-- 2-Column Layout on Desktop -->
            <div class="lg:grid lg:grid-cols-2 lg:gap-6">

                <!-- Left: Loyalty Card -->
                <div>
                    <div id="loyaltyCard" class="loyalty-card p-5 md:p-6 shadow-xl mb-4 lg:mb-0"
                         style="background: linear-gradient(135deg, var(--primary), var(--secondary));">

                        <!-- Card Header -->
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1 min-w-0">
                                <p id="cardBizName" class="text-white font-extrabold text-base md:text-lg truncate">Loyalty Card</p>
                                <p id="cardLabel" class="text-white/50 text-xs uppercase tracking-widest mt-0.5 font-semibold">LOYALTY CARD #-</p>
                            </div>
                            <div id="cardLogo" class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 ml-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21 8 14 2 9.4h7.6L12 2z"/></svg>
                            </div>
                        </div>

                        <!-- Token Circles -->
                        <div id="tokenCirclesArea" class="my-5 space-y-2.5 sm:space-y-3"></div>

                        <!-- Progress -->
                        <div class="mb-3">
                            <div class="flex justify-between items-center text-xs md:text-sm text-white/60 mb-1.5">
                                <span><span id="progressText" class="text-white font-bold">0/10</span> tokens</span>
                                <span id="progressPercent" class="font-semibold">0%</span>
                            </div>
                            <div class="h-2.5 md:h-3 bg-white/10 rounded-full overflow-hidden">
                                <div id="progressBar" class="h-full rounded-full progress-fill"
                                     style="width: 0%; background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.6));"></div>
                            </div>
                        </div>

                        <!-- Total Spent -->
                        <div id="totalSpentRow" class="text-center mb-3 hidden">
                            <p class="text-white/50 text-xs">Total Spent</p>
                            <p id="totalSpent" class="text-white font-extrabold text-xl md:text-2xl">RM 0.00</p>
                        </div>

                        <!-- Status Message -->
                        <div id="cardStatusMsg" class="text-center text-white/60 text-xs md:text-sm mt-2"></div>
                    </div>
                </div>

                <!-- Right: Reward Info + Quick Stats -->
                <div class="space-y-4">
                    <!-- Reward Info -->
                    <div id="rewardBox" class="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 hidden">
                        <div class="flex items-start gap-3">
                            <div id="rewardIcon" class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                 style="background: color-mix(in srgb, var(--primary) 12%, transparent);">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-gray-900 text-sm md:text-base">Your Reward</p>
                                <p id="rewardDesc" class="text-gray-500 text-xs md:text-sm mt-0.5 leading-relaxed"></p>
                            </div>
                        </div>
                        <!-- Alert when completed -->
                        <div id="rewardAlert" class="mt-3 p-3 rounded-xl text-center hidden"
                             style="background: color-mix(in srgb, var(--primary) 8%, transparent);">
                            <p class="text-sm font-bold" style="color: var(--primary);">Card Completed! Show to staff to claim.</p>
                        </div>
                    </div>

                    <!-- Quick Stats -->
                    <div class="grid grid-cols-2 gap-3 md:gap-4">
                        <div class="bg-white rounded-xl p-3.5 md:p-4 shadow-sm border border-gray-100 text-center">
                            <p id="qsTokens" class="text-2xl md:text-3xl font-extrabold" style="color: var(--primary);">0</p>
                            <p class="text-xs text-gray-400 mt-0.5 font-medium">Tokens</p>
                            <p id="qsTokensSub" class="text-[10px] text-gray-300 font-medium">/ 10</p>
                        </div>
                        <div class="bg-white rounded-xl p-3.5 md:p-4 shadow-sm border border-gray-100 text-center">
                            <p id="qsRemaining" class="text-2xl md:text-3xl font-extrabold text-amber-500">0</p>
                            <p class="text-xs text-gray-400 mt-0.5 font-medium">To Go</p>
                        </div>
                        <div class="bg-white rounded-xl p-3.5 md:p-4 shadow-sm border border-gray-100 text-center">
                            <p id="qsSpent" class="text-lg md:text-xl font-extrabold text-gray-800">RM 0</p>
                            <p class="text-xs text-gray-400 mt-0.5 font-medium">Total Spent</p>
                        </div>
                        <div class="bg-white rounded-xl p-3.5 md:p-4 shadow-sm border border-gray-100 text-center">
                            <p id="qsCard" class="text-2xl md:text-3xl font-extrabold text-gray-400">#-</p>
                            <p class="text-xs text-gray-400 mt-0.5 font-medium">Card</p>
                        </div>
                    </div>

                    <!-- Token List (Desktop) -->
                    <div class="hidden lg:block">
                        <h3 class="font-bold text-gray-700 mb-3 text-sm">Token Details</h3>
                        <div id="tokenListDesktop" class="space-y-2 max-h-64 overflow-y-auto hide-scroll"></div>
                    </div>
                </div>
            </div>

            <!-- Token List (Mobile) -->
            <div class="lg:hidden mt-4">
                <h3 class="font-bold text-gray-700 mb-3 text-sm">Token Details</h3>
                <div id="tokenListMobile" class="space-y-2"></div>
                <div id="noTokens" class="text-center py-10 text-gray-300 hidden">
                    <svg class="mx-auto mb-2" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                    <p class="text-sm font-medium">Belum ada token</p>
                </div>
            </div>
        </div>

        <!-- ===== HISTORY TAB ===== -->
        <div id="tab-history" class="tab-panel px-4 md:px-6 lg:px-8 pt-4 md:pt-6 hidden">
            <!-- Header -->
            <div class="mb-5">
                <h2 class="text-xl md:text-2xl font-extrabold text-gray-900">Sejarah</h2>
                <p class="text-sm text-gray-400 mt-0.5">Semua kad loyalty anda</p>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-3 md:gap-4 mb-5">
                <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100 text-center">
                    <div class="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style="background: color-mix(in srgb, var(--primary) 12%, transparent);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    </div>
                    <p id="hStatTokens" class="text-xl md:text-2xl font-extrabold text-gray-900">0</p>
                    <p class="text-[10px] md:text-xs text-gray-400 font-medium">Total Tokens</p>
                </div>
                <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100 text-center">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 mx-auto mb-1.5 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    </div>
                    <p id="hStatRedeemed" class="text-xl md:text-2xl font-extrabold text-gray-900">0</p>
                    <p class="text-[10px] md:text-xs text-gray-400 font-medium">Rewards</p>
                </div>
                <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100 text-center">
                    <div class="w-8 h-8 rounded-lg bg-gray-100 mx-auto mb-1.5 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </div>
                    <p id="hStatCards" class="text-xl md:text-2xl font-extrabold text-gray-900">0</p>
                    <p class="text-[10px] md:text-xs text-gray-400 font-medium">Cards</p>
                </div>
            </div>

            <!-- Card List -->
            <div id="historyList" class="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0"></div>
            <div id="noHistory" class="text-center py-16 text-gray-300 hidden">
                <svg class="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p class="text-sm font-medium">Tiada sejarah kad</p>
            </div>
        </div>

        <!-- ===== PROFILE TAB ===== -->
        <div id="tab-profile" class="tab-panel px-4 md:px-6 lg:px-8 pt-4 md:pt-6 hidden">

            <!-- Profile Hero Card -->
            <div id="profileHero" class="rounded-2xl p-5 md:p-6 shadow-xl mb-4 relative overflow-hidden"
                 style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                <!-- Decorative -->
                <div class="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/4"></div>
                <div class="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5 bg-white translate-y-1/2 -translate-x-1/4"></div>

                <div class="relative z-10">
                    <!-- Avatar + Name -->
                    <div class="flex items-center gap-4 mb-5">
                        <div id="pAvatar" class="w-18 h-18 md:w-20 md:h-20 rounded-full bg-white/20 ring-4 ring-white/30 flex items-center justify-center text-white font-extrabold text-2xl md:text-3xl shadow-lg" style="width:72px;height:72px;">
                            ?
                        </div>
                        <div class="flex-1 min-w-0">
                            <p id="pName" class="text-white font-extrabold text-xl md:text-2xl truncate">-</p>
                            <p class="flex items-center gap-1.5 text-white/70 text-xs md:text-sm mt-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                <span id="pCode" class="font-mono">-</span>
                            </p>
                        </div>
                    </div>

                    <!-- Info Rows inside card -->
                    <div class="space-y-3 mb-5">
                        <!-- Email -->
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Email</p>
                                <p id="pInfoEmail" class="text-white/90 text-sm font-medium truncate">-</p>
                            </div>
                        </div>
                        <!-- Phone -->
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Telefon</p>
                                <p id="pInfoPhone" class="text-white/90 text-sm font-medium truncate">-</p>
                            </div>
                        </div>
                        <!-- Vehicles badges (hidden when vehicle not required) -->
                        <div id="pVehicleBadgesRow" class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1.5">Kenderaan</p>
                                <div id="pVehicleBadges" class="flex flex-wrap gap-1.5">
                                    <span class="text-white/40 text-xs">-</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Profile Stats Bar -->
                    <div id="profileStatsBar" class="pt-4 border-t border-white/15 grid grid-cols-3 gap-2 text-center">
                        <div id="pStatVehiclesCol">
                            <p id="pStatVehicles" class="text-white font-extrabold text-lg">0</p>
                            <p class="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Kenderaan</p>
                        </div>
                        <div id="pStatTokensCol" class="border-l border-r border-white/15">
                            <p id="pStatTokens" class="text-white font-extrabold text-lg">0</p>
                            <p class="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Token</p>
                        </div>
                        <div>
                            <p id="pStatCards" class="text-white font-extrabold text-lg">0</p>
                            <p class="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Selesai</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Collapsible Sections -->
            <div class="space-y-3">

                <!-- My Vehicles - Collapsible (hidden when vehicle not required) -->
                <div id="vehicleSectionWrapper" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onclick="toggleSection('vehicleSection')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: color-mix(in srgb, var(--primary) 10%, transparent);">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                            </div>
                            <span class="font-bold text-gray-800">Kenderaan Saya</span>
                            <span id="vehicleCount" class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:var(--primary);">0</span>
                        </div>
                        <svg id="vehicleSectionArrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" class="transition-transform duration-300"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div id="vehicleSection" class="hidden">
                        <div class="px-5 pb-4">
                            <div class="flex items-center justify-end mb-3">
                                <button onclick="openAddVehicle()" class="flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style="color: var(--primary);">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Tambah
                                </button>
                            </div>
                            <div id="vehicleList" class="space-y-2"></div>
                            <div id="noVehicles" class="text-center py-6 text-gray-300 hidden">
                                <svg class="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                                <p class="text-xs font-medium">Tiada kenderaan</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Edit Profile - Collapsible -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onclick="toggleSection('editSection')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </div>
                            <span class="font-bold text-gray-800">Edit Profil</span>
                        </div>
                        <svg id="editSectionArrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" class="transition-transform duration-300"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div id="editSection" class="hidden">
                        <div class="px-5 pb-5 space-y-3">
                            <div>
                                <label class="flex items-center gap-2 text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Nama <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="editName" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-800 transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none" placeholder="Nama penuh anda">
                            </div>
                            <div>
                                <label class="flex items-center gap-2 text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Telefon
                                </label>
                                <input type="tel" id="editPhone" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-800 transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none" placeholder="01X-XXXXXXX">
                            </div>
                            <div>
                                <label class="flex items-center gap-2 text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Email <span class="text-gray-300 font-normal normal-case">(Pilihan)</span>
                                </label>
                                <input type="email" id="editEmail" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-800 transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none" placeholder="email@contoh.com">
                            </div>
                            <button onclick="saveProfile()"
                                class="w-full mt-1 py-3 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                                style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    </div>
</div>


<!-- ==================== BOTTOM NAVIGATION ==================== -->
<nav id="bottomNav" class="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg <?= $isLoggedIn ? '' : 'hidden' ?>">
    <div class="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-5xl flex justify-around bottom-nav">
        <button onclick="switchTab('card')" id="nav-card" class="flex-1 py-2.5 md:py-3 flex flex-col items-center gap-1 transition-colors nav-btn nav-active">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="md:w-6 md:h-6">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span class="text-xs md:text-sm font-medium">Kad Saya</span>
        </button>
        <button onclick="switchTab('history')" id="nav-history" class="flex-1 py-2.5 md:py-3 flex flex-col items-center gap-1 transition-colors nav-btn text-gray-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="md:w-6 md:h-6">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="text-xs md:text-sm font-medium">Sejarah</span>
        </button>
        <button onclick="switchTab('profile')" id="nav-profile" class="flex-1 py-2.5 md:py-3 flex flex-col items-center gap-1 transition-colors nav-btn text-gray-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="md:w-6 md:h-6">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="text-xs md:text-sm font-medium">Profil</span>
        </button>
        <button onclick="doLogout()" class="flex-1 py-2.5 md:py-3 flex flex-col items-center gap-1 transition-colors text-red-400 hover:text-red-500">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="md:w-6 md:h-6">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span class="text-xs md:text-sm font-medium">Log Keluar</span>
        </button>
    </div>
</nav>


<!-- ==================== ADD VEHICLE MODAL ==================== -->
<div id="addVehicleModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] hidden items-end sm:items-center justify-center">
    <div class="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 slide-up">
        <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-extrabold text-gray-900">Tambah Kenderaan</h3>
            <button onclick="closeModal('addVehicleModal')" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Nombor Plat</label>
                <input type="text" id="addPlate" class="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm uppercase tracking-wider text-center font-bold text-gray-800" placeholder="cth: WA 1234 A">
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Jenis</label>
                <div class="grid grid-cols-2 gap-2" id="vehicleTypeSelector">
                    <button type="button" onclick="selectVehicleType('car')" class="vtype-btn vtype-active py-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                        Kereta
                    </button>
                    <button type="button" onclick="selectVehicleType('motorcycle')" class="vtype-btn py-3 rounded-xl border-2 border-gray-200 text-gray-400 text-sm font-semibold transition flex items-center justify-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17h7M5 14l4-7h4l3 7"/></svg>
                        Motosikal
                    </button>
                </div>
                <input type="hidden" id="addVehicleType" value="car">
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Model (Pilihan)</label>
                <input type="text" id="addVehicleModel" class="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm" placeholder="cth: Perodua Myvi">
            </div>
        </div>
        <button onclick="saveVehicle()"
            class="w-full mt-5 py-3.5 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg"
            style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
            Tambah Kenderaan
        </button>
    </div>
</div>



<!-- ==================== HIDDEN A5 PDF RECEIPT ==================== -->
<div id="receiptPdfWrap" style="position:fixed; left:-9999px; top:0; z-index:-1;">
    <div id="receiptPdfContent" style="width:420px; background:#fff; font-family:Inter,system-ui,sans-serif;"></div>
</div>

<!-- ==================== RECEIPT MODAL ==================== -->
<div id="receiptModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] hidden items-end sm:items-center justify-center">
    <div class="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col slide-up">
        <!-- Drag indicator (mobile) -->
        <div class="sm:hidden flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 rounded-full bg-gray-300"></div>
        </div>
        <!-- Close button -->
        <button onclick="closeModal('receiptModal')" class="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <!-- Scrollable receipt content -->
        <div class="overflow-y-auto flex-1 px-5 sm:px-6">
            <div id="receiptContent" class="py-5 sm:py-6 bg-white">
                <!-- Dynamically populated by showReceipt() -->
            </div>
        </div>
        <!-- Action buttons -->
        <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50">
            <div class="flex gap-2">
                <button id="receiptWhatsappBtn" onclick="shareReceiptWhatsApp()"
                    class="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    style="background: #25D366;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    <span>WhatsApp</span>
                </button>
                <button id="receiptPdfBtn" onclick="downloadReceiptPDF()"
                    class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98] border-2"
                    style="border-color: var(--primary); color: var(--primary);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>PDF</span>
                </button>
            </div>
            <button onclick="closeModal('receiptModal')"
                class="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Tutup
            </button>
        </div>
    </div>
</div>


<!-- ==================== LOADING OVERLAY ==================== -->
<div id="loadingOverlay" class="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] hidden items-center justify-center">
    <div class="loader"></div>
</div>


<!-- ==================== PWA INSTALL BANNER ==================== -->
<!-- Android / Chrome -->
<div id="installBanner" class="fixed bottom-0 left-0 right-0 z-[200] hidden">
    <div class="max-w-lg mx-auto px-4 pb-4">
        <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-center gap-4" style="box-shadow: 0 -4px 30px rgba(0,0,0,0.12);">
            <div id="installLogo" class="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md"
                 style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div class="flex-1 min-w-0">
                <p id="installTitle" class="font-extrabold text-gray-900 text-sm">ANSSPA Rewards</p>
                <p class="text-xs text-gray-400 mt-0.5">Tambah ke skrin utama untuk akses pantas</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="dismissInstall()" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button onclick="doInstall()" class="px-4 py-2 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg"
                    style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                    Pasang
                </button>
            </div>
        </div>
    </div>
</div>

<!-- iOS Safari -->
<div id="iosBanner" class="fixed bottom-0 left-0 right-0 z-[200] hidden">
    <div class="max-w-lg mx-auto px-4 pb-4">
        <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 text-center" style="box-shadow: 0 -4px 30px rgba(0,0,0,0.12);">
            <button onclick="dismissIosBanner()" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div id="iosLogo" class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden shadow-md"
                 style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <p id="iosTitle" class="font-extrabold text-gray-900 text-base mb-1">ANSSPA Rewards</p>
            <p class="text-xs text-gray-400 mb-4">Tambah ke skrin utama untuk akses pantas</p>
            <div class="flex items-center justify-center gap-2 text-sm text-gray-600">
                <span>Tekan</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span>kemudian <strong>"Add to Home Screen"</strong></span>
            </div>
        </div>
    </div>
</div>

<style>
    @keyframes bannerSlideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    #installBanner > div, #iosBanner > div {
        animation: bannerSlideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    }
</style>


<script src="assets/app.js?v=<?= time() ?>"></script>
<script>loadPublicSettings();</script>
<?php if ($isLoggedIn): ?>
<script>loadApp();</script>
<?php endif; ?>

<script>
// ============================================
// PWA Install Prompt
// ============================================
let deferredPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Android/Chrome: capture install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show banner if not dismissed before
    if (!localStorage.getItem('pwa_dismissed')) {
        setTimeout(() => showInstallBanner(), 2000);
    }
});

function showInstallBanner() {
    // Update logo if available
    const logoProxy = document.querySelector('#loginLogo img');
    if (logoProxy) {
        document.getElementById('installLogo').innerHTML =
            `<img src="${logoProxy.src}" class="w-full h-full rounded-2xl object-contain">`;
    }
    if (settingsData.business_name) {
        document.getElementById('installTitle').textContent = settingsData.business_name;
    }
    document.getElementById('installBanner').classList.remove('hidden');
}

async function doInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('installBanner').classList.add('hidden');
    if (outcome === 'accepted') {
        localStorage.setItem('pwa_dismissed', '1');
    }
}

function dismissInstall() {
    document.getElementById('installBanner').classList.add('hidden');
    localStorage.setItem('pwa_dismissed', '1');
}

// iOS Safari: detect and show manual instructions
function checkIos() {
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isSafari = /safari/.test(navigator.userAgent.toLowerCase()) && !/chrome|crios|fxios/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.navigator.standalone === true;

    if (isIos && isSafari && !isStandalone && !localStorage.getItem('ios_dismissed')) {
        setTimeout(() => {
            const logoProxy = document.querySelector('#loginLogo img');
            if (logoProxy) {
                document.getElementById('iosLogo').innerHTML =
                    `<img src="${logoProxy.src}" class="w-full h-full rounded-2xl object-contain">`;
            }
            if (settingsData.business_name) {
                document.getElementById('iosTitle').textContent = settingsData.business_name;
            }
            document.getElementById('iosBanner').classList.remove('hidden');
        }, 3000);
    }
}

function dismissIosBanner() {
    document.getElementById('iosBanner').classList.add('hidden');
    localStorage.setItem('ios_dismissed', '1');
}

// Check iOS after settings load
window.addEventListener('load', () => setTimeout(checkIos, 1000));
</script>
</body>
</html>
