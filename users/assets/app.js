// ============================================
// RewardPoints User App - Frontend Logic
// ============================================

const API = 'api';
let currentTab = 'card';
let profileData = null;
let vehiclesData = [];
let settingsData = {};
let selectedVehicleType = 'car';
let regVehicleType = 'car';
let regPhone = '';

// ============================================
// API Helper
// ============================================
async function api(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}/${endpoint}`, opts);
    return await res.json();
}

// ============================================
// Toast
// ============================================
function showToast(msg, type = 'success') {
    document.querySelectorAll('.app-toast').forEach(t => t.remove());
    const colors = {
        success: 'linear-gradient(135deg, #10b981, #34d399)',
        error:   'linear-gradient(135deg, #ef4444, #f87171)',
        info:    'linear-gradient(135deg, var(--primary), var(--secondary))',
    };
    const el = document.createElement('div');
    el.className = 'app-toast';
    el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:14px;color:#fff;font-weight:600;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.15);background:${colors[type] || colors.info};animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ============================================
// Loading
// ============================================
function showLoading() {
    const el = document.getElementById('loadingOverlay');
    el.classList.remove('hidden'); el.classList.add('flex');
}
function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    el.classList.add('hidden'); el.classList.remove('flex');
}

// ============================================
// Login
// ============================================
async function doLogin() {
    const phone = document.getElementById('phoneInput').value.trim();
    if (!phone || phone.length < 9) { showToast('Sila masukkan nombor telefon yang sah', 'error'); return; }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Sila tunggu...';

    try {
        const res = await api('login.php', 'POST', { phone });
        if (res.success) {
            if (res.is_new) {
                // New user - show registration
                regPhone = res.phone || phone;
                showRegisterScreen(regPhone);
            } else {
                // Existing user - login
                showToast(res.message);
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('appScreen').classList.remove('hidden');
                document.getElementById('bottomNav').classList.remove('hidden');
                loadApp();
            }
        } else {
            showToast(res.message || 'Ralat log masuk', 'error');
        }
    } catch { showToast('Ralat sambungan. Sila cuba lagi.', 'error'); }

    btn.disabled = false; btn.textContent = 'Log Masuk';
}

document.getElementById('phoneInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });

// ============================================
// Registration Flow
// ============================================
function showRegisterScreen(phone) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.remove('hidden');
    document.getElementById('regPhone').value = phone;
    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPlate').value = '';
    document.getElementById('regVehicleModel').value = '';
    regVehicleType = 'car';
    document.getElementById('regVehicleType').value = 'car';
    showRegStep(1);
    // Focus name input
    setTimeout(() => document.getElementById('regName').focus(), 300);
}

function backToLogin() {
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

function showRegStep(step) {
    document.getElementById('regStep1').classList.add('hidden');
    document.getElementById('regStep2').classList.add('hidden');
    document.getElementById('regStep3').classList.add('hidden');
    document.getElementById(`regStep${step}`).classList.remove('hidden');
    document.getElementById(`regStep${step}`).classList.add('fade-in');

    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';

    // Update progress dots
    if (requireVehicle) {
        // 3-step mode: update dots 2 and 3
        for (let i = 2; i <= 3; i++) {
            const circle = document.getElementById(`step${i}Circle`);
            const bar = document.getElementById(`step${i}Bar`);
            if (i <= step) {
                circle.style.background = 'var(--primary)';
                circle.style.color = 'white';
                circle.classList.add('shadow-sm');
                if (bar) { bar.style.background = 'var(--primary)'; }
            } else {
                circle.style.background = '#e5e7eb';
                circle.style.color = '#9ca3af';
                circle.classList.remove('shadow-sm');
                if (bar) { bar.style.background = '#e5e7eb'; }
            }
        }
    } else {
        // 2-step mode: only step1Bar and step3Circle visible
        const circle = document.getElementById('step3Circle');
        const step1Bar = document.getElementById('step1Bar');
        if (step === 3) {
            // Showing confirmation (Step 2 in 2-step mode)
            circle.style.background = 'var(--primary)';
            circle.style.color = 'white';
            circle.classList.add('shadow-sm');
            if (step1Bar) step1Bar.style.background = 'var(--primary)';
        } else {
            // Showing Step 1
            circle.style.background = '#e5e7eb';
            circle.style.color = '#9ca3af';
            circle.classList.remove('shadow-sm');
            if (step1Bar) step1Bar.style.background = 'var(--primary)';
        }
    }
}

function goToStep1() { showRegStep(1); }

function goToStep2() {
    const name = document.getElementById('regName').value.trim();
    const errEl = document.getElementById('regNameErr');
    if (!name || name.length < 2) {
        errEl.textContent = 'Sila masukkan nama penuh anda (minimum 2 aksara)';
        errEl.classList.remove('hidden');
        document.getElementById('regName').focus();
        return;
    }
    errEl.classList.add('hidden');

    // If vehicle not required, skip Step 2 → go direct to Step 3
    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';
    if (!requireVehicle) {
        populateConfirmation();
        showRegStep(3);
        return;
    }

    showRegStep(2);
    setTimeout(() => document.getElementById('regPlate').focus(), 300);
}

function populateConfirmation() {
    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';

    document.getElementById('confirmPhone').textContent = document.getElementById('regPhone').value;
    document.getElementById('confirmName').textContent = document.getElementById('regName').value.trim();

    const email = document.getElementById('regEmail').value.trim();
    if (email) {
        document.getElementById('confirmEmailRow').classList.remove('hidden');
        document.getElementById('confirmEmail').textContent = email;
    } else {
        document.getElementById('confirmEmailRow').classList.add('hidden');
    }

    const confirmVehicleRow = document.getElementById('confirmVehicleRow');
    if (requireVehicle) {
        const plate = document.getElementById('regPlate').value.trim();
        const typeLabels = { car: 'Kereta', motorcycle: 'Motosikal' };
        const model = document.getElementById('regVehicleModel').value.trim();
        let vehicleText = plate.toUpperCase() + ' (' + (typeLabels[regVehicleType] || regVehicleType) + ')';
        if (model) vehicleText += ' - ' + model;
        document.getElementById('confirmVehicle').textContent = vehicleText;
        if (confirmVehicleRow) confirmVehicleRow.classList.remove('hidden');
    } else {
        if (confirmVehicleRow) confirmVehicleRow.classList.add('hidden');
    }
}

function goToStep3() {
    const plate = document.getElementById('regPlate').value.trim();
    const errEl = document.getElementById('regPlateErr');
    if (!plate || plate.length < 2) {
        errEl.textContent = 'Sila masukkan nombor plat kenderaan';
        errEl.classList.remove('hidden');
        document.getElementById('regPlate').focus();
        return;
    }
    errEl.classList.add('hidden');
    populateConfirmation();
    showRegStep(3);
}

function goToStep2FromConfirm() {
    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';
    if (!requireVehicle) {
        // No vehicle step, go back to Step 1
        showRegStep(1);
    } else {
        showRegStep(2);
    }
}

function selectRegVehicleType(type) {
    regVehicleType = type;
    document.getElementById('regVehicleType').value = type;
    document.querySelectorAll('.rvtype-btn').forEach(btn => {
        btn.classList.remove('rvtype-active');
        btn.classList.add('border-gray-200', 'text-gray-400');
    });
    const btns = document.querySelectorAll('.rvtype-btn');
    const idx = type === 'car' ? 0 : 1;
    if (btns[idx]) {
        btns[idx].classList.add('rvtype-active');
        btns[idx].classList.remove('border-gray-200', 'text-gray-400');
    }
}

async function submitRegistration() {
    const btn = document.getElementById('regSubmitBtn');
    btn.disabled = true;
    showLoading();

    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';
    const data = {
        phone: document.getElementById('regPhone').value.trim(),
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
    };

    if (requireVehicle) {
        data.plate_number = document.getElementById('regPlate').value.trim();
        data.vehicle_type = regVehicleType;
        data.vehicle_model = document.getElementById('regVehicleModel').value.trim();
    }

    try {
        const res = await api('register.php', 'POST', data);
        if (res.success) {
            showToast(res.message);
            document.getElementById('registerScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.remove('hidden');
            document.getElementById('bottomNav').classList.remove('hidden');
            loadApp();
        } else {
            showToast(res.message || 'Ralat pendaftaran', 'error');
        }
    } catch { showToast('Ralat sambungan. Sila cuba lagi.', 'error'); }

    btn.disabled = false;
    hideLoading();
}

// ============================================
// Logout
// ============================================
async function doLogout() {
    await api('logout.php', 'POST');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('phoneInput').value = '';
    profileData = null; vehiclesData = [];
    showToast('Berjaya log keluar');
}

// ============================================
// Tab Switching
// ============================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) { panel.classList.remove('hidden'); panel.classList.add('fade-in'); }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('nav-active');
        btn.classList.add('text-gray-400');
    });
    const navBtn = document.getElementById(`nav-${tab}`);
    if (navBtn) { navBtn.classList.add('nav-active'); navBtn.classList.remove('text-gray-400'); }

    if (tab === 'card') loadCard();
    else if (tab === 'history') loadHistory();
    else if (tab === 'profile') loadProfile();
}

// ============================================
// Load App
// ============================================
async function loadApp() {
    // Load profile first for header
    try {
        const res = await api('profile.php');
        if (res.success) {
            profileData = res.user;
            vehiclesData = res.vehicles || [];
            updateHeader();
        }
    } catch {}
    switchTab('card');

    // Initialize push notifications (non-blocking)
    setTimeout(() => initPushNotifications(), 2000);
}

// ============================================
// Push Notifications (Firebase Cloud Messaging)
// ============================================
async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    try {
        // Only request permission if not already denied
        if (Notification.permission === 'denied') return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Wait for service worker to be ready (it has Firebase SDK loaded)
        const reg = await navigator.serviceWorker.ready;

        // Use Firebase Messaging to get FCM token
        if (typeof firebase === 'undefined') {
            // Load Firebase SDK dynamically
            await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
        }

        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: 'AIzaSyCdys-Yo0dGps0GXikn1cM2YAptKBN2og4',
                authDomain: 'ansspa-30912.firebaseapp.com',
                projectId: 'ansspa-30912',
                storageBucket: 'ansspa-30912.firebasestorage.app',
                messagingSenderId: '898403421534',
                appId: '1:898403421534:web:9cf90fedbd1c7d5657d3cf',
            });
        }

        const messaging = firebase.messaging();

        // Get FCM token using the service worker registration
        const fcmToken = await messaging.getToken({
            vapidKey: settingsData.vapid_public_key || '',
            serviceWorkerRegistration: reg,
        });

        if (!fcmToken) return;

        // Send FCM token to backend
        await api('push-subscribe.php', 'POST', {
            fcm_token: fcmToken,
        });

        // Listen for foreground messages
        messaging.onMessage((payload) => {
            const data = payload.notification || payload.data || {};
            if (data.title && Notification.permission === 'granted') {
                reg.showNotification(data.title, {
                    body: data.body || '',
                    icon: data.icon || '/users/api/logo-proxy.php',
                    data: { url: payload.fcmOptions?.link || data.url || '/users/' },
                    vibrate: [200, 100, 200],
                    tag: 'loyalty-notification',
                    renotify: true,
                });
            }
        });

    } catch (err) {
        console.log('Push setup:', err.message || err);
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

function updateHeader() {
    if (!profileData) return;
    const name = profileData.name || 'User';
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('headerAvatar').textContent = initials;
    document.getElementById('headerName').textContent = name.split(' ')[0];
    document.getElementById('headerCode').textContent = profileData.user_code || '';
}

// ============================================
// Apply Dynamic Theme
// ============================================
async function loadPublicSettings() {
    try {
        const res = await api('settings-public.php');
        if (res.success && res.settings) {
            settingsData = res.settings;
            applyTheme(res.settings);
            setupRegistrationMode();
            checkAutoRegister();
        }
    } catch {}
}

// ============================================
// QR Code Auto-Register Detection
// ============================================
function checkAutoRegister() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('register') !== '1') return;

    // If already logged in, skip
    const appScreen = document.getElementById('appScreen');
    if (appScreen && !appScreen.classList.contains('hidden')) return;

    // Show login screen with registration prompt
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('hidden');

    // Update subtitle to indicate registration
    const subtitle = loginScreen?.querySelector('.text-gray-400');
    if (subtitle) subtitle.textContent = 'Masukkan nombor telefon untuk mendaftar';

    // Focus phone input
    setTimeout(() => {
        const phoneInput = document.getElementById('phoneInput');
        if (phoneInput) phoneInput.focus();
    }, 500);

    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname);
}

function setupRegistrationMode() {
    const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';
    const step2Dot = document.getElementById('step2Dot');
    const step3Circle = document.getElementById('step3Circle');
    const step1Label = document.getElementById('step1Label');
    const step3Label = document.getElementById('step3Label');

    if (!requireVehicle) {
        // Hide Step 2 (vehicle) stepper dot
        if (step2Dot) step2Dot.classList.add('hidden');
        // Renumber Step 3 circle as "2"
        if (step3Circle) step3Circle.textContent = '2';
        // Update step labels: "Langkah X daripada 2"
        if (step1Label) step1Label.textContent = 'Langkah 1 daripada 2';
        if (step3Label) step3Label.textContent = 'Langkah 2 daripada 2';
    } else {
        // Restore defaults if toggled back on
        if (step2Dot) step2Dot.classList.remove('hidden');
        if (step3Circle) step3Circle.textContent = '3';
        if (step1Label) step1Label.textContent = 'Langkah 1 daripada 3';
        if (step3Label) step3Label.textContent = 'Langkah 3 daripada 3';
    }
}

function applyTheme(settings) {
    if (!settings) return;
    const primary = settings.primary_color || '#6366f1';
    const secondary = settings.secondary_color || '#8b5cf6';
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--secondary', secondary);

    // Update nav active colors
    const style = document.getElementById('dynamicNavStyle') || document.createElement('style');
    style.id = 'dynamicNavStyle';
    style.textContent = `.nav-active { color: ${primary} !important; } .nav-active svg { stroke: ${primary}; }`;
    if (!style.parentNode) document.head.appendChild(style);

    // Update meta theme
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', primary);

    // Update login title + page title
    if (settings.business_name) {
        document.getElementById('loginTitle').textContent = settings.business_name;
        document.title = settings.business_name;
    }

    // Update login & register logo with business logo
    if (settings.business_logo) {
        const logoUrl = settings.business_logo;
        const loginLogo = document.getElementById('loginLogo');
        if (loginLogo) {
            loginLogo.style.background = 'none';
            loginLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full rounded-2xl object-contain" onerror="this.parentElement.style.background='linear-gradient(135deg, var(--primary), var(--secondary))';this.parentElement.innerHTML='<svg width=44 height=44 viewBox=\\'0 0 24 24\\' fill=none stroke=white stroke-width=2 stroke-linecap=round stroke-linejoin=round><rect x=1 y=4 width=22 height=16 rx=2 ry=2/><line x1=1 y1=10 x2=23 y2=10/></svg>'">`;
        }
        const regLogo = document.getElementById('regLogo');
        if (regLogo) {
            regLogo.style.background = 'none';
            regLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full rounded-2xl object-contain" onerror="this.parentElement.style.background='linear-gradient(135deg, var(--primary), var(--secondary))';this.parentElement.innerHTML='<svg width=28 height=28 viewBox=\\'0 0 24 24\\' fill=none stroke=white stroke-width=2><path d=\\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\\'/><circle cx=12 cy=7 r=4/></svg>'">`;
        }
    }
}

// ============================================
// MY CARD TAB
// ============================================
async function loadCard() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.style.animation = 'spin 0.7s linear';
    setTimeout(() => { if (refreshBtn) refreshBtn.style.animation = ''; }, 700);

    try {
        const res = await api('card.php');
        if (!res.success) {
            if (res.message && res.message.includes('Not logged in')) {
                document.getElementById('appScreen').classList.add('hidden');
                document.getElementById('bottomNav').classList.add('hidden');
                document.getElementById('loginScreen').classList.remove('hidden');
            }
            return;
        }

        const { card, settings } = res;
        settingsData = { ...settingsData, ...(settings || {}) };
        applyTheme(settings);

        const tokensPerCard = parseInt(settings?.tokens_per_card) || 10;

        // Card header
        document.getElementById('cardBizName').textContent = settings?.business_name || 'Loyalty Card';

        // Business logo
        if (settings?.business_logo) {
            const logoUrl = settings.business_logo;
            document.getElementById('cardLogo').innerHTML = `<img src="${logoUrl}" class="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" onerror="this.parentElement.innerHTML='<svg width=24 height=24 viewBox=\\'0 0 24 24\\' fill=none stroke=white stroke-width=2><path d=\\'M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21 8 14 2 9.4h7.6L12 2z\\'/></svg>'">`;
        }

        // Reward box
        if (settings?.reward_description) {
            document.getElementById('rewardBox').classList.remove('hidden');
            document.getElementById('rewardDesc').textContent = `Collect ${tokensPerCard} tokens to earn ${settings.reward_description}`;
        }

        if (!card) {
            document.getElementById('cardLabel').textContent = 'TIADA KAD AKTIF';
            document.getElementById('tokenCirclesArea').innerHTML = renderTokenCircles(0, tokensPerCard);
            document.getElementById('progressText').textContent = `0/${tokensPerCard}`;
            document.getElementById('progressPercent').textContent = '0%';
            document.getElementById('progressBar').style.width = '0%';
            document.getElementById('totalSpentRow').classList.add('hidden');
            document.getElementById('cardStatusMsg').innerHTML = `<span class="text-white/60">Collect ${tokensPerCard} tokens to earn ${esc(settings?.reward_description || 'a reward')}</span>`;
            renderQuickStats(0, tokensPerCard, 0, '-');
            renderTokenList([]);
            return;
        }

        const earned = card.tokens_earned;
        const required = card.tokens_required;
        const pct = Math.round((earned / required) * 100);

        document.getElementById('cardLabel').textContent = `LOYALTY CARD #${card.card_number}`;

        // Token circles
        document.getElementById('tokenCirclesArea').innerHTML = renderTokenCircles(earned, required, card.tokens);

        // Progress
        document.getElementById('progressText').textContent = `${earned}/${required}`;
        document.getElementById('progressPercent').textContent = `${pct}%`;
        const bar = document.getElementById('progressBar');
        bar.style.width = '0%';
        if (card.status === 'completed') {
            bar.style.background = 'linear-gradient(90deg, #fcd34d, #f59e0b)';
        } else {
            bar.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.6))';
        }
        requestAnimationFrame(() => { bar.style.width = pct + '%'; });

        // Total spent
        if (card.total_amount > 0) {
            document.getElementById('totalSpentRow').classList.remove('hidden');
            document.getElementById('totalSpent').textContent = 'RM ' + formatNumber(card.total_amount);
        } else {
            document.getElementById('totalSpentRow').classList.add('hidden');
        }

        // Status message
        const remaining = required - earned;
        if (card.status === 'completed') {
            document.getElementById('cardStatusMsg').innerHTML = `
                <div class="status-pulse flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fcd34d" stroke="#fcd34d" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    <span class="text-yellow-300 font-extrabold text-sm">FREE REWARD EARNED!</span>
                </div>`;
            document.getElementById('rewardAlert').classList.remove('hidden');
        } else if (remaining <= 2 && remaining > 0) {
            document.getElementById('cardStatusMsg').innerHTML = `<span class="text-yellow-200 font-semibold">Almost there! Just ${remaining} more to go!</span>`;
            document.getElementById('rewardAlert').classList.add('hidden');
        } else {
            document.getElementById('cardStatusMsg').innerHTML = `<span class="text-white/60">Collect ${required} tokens to earn ${esc(settings?.reward_description || 'a reward')}</span>`;
            document.getElementById('rewardAlert').classList.add('hidden');
        }

        renderQuickStats(earned, required, card.total_amount, card.card_number);
        renderTokenList(card.tokens || []);

    } catch (e) { console.error('loadCard:', e); }
}

function renderTokenCircles(earned, total, tokens) {
    tokens = tokens || [];
    const perRow = Math.ceil(total / 2);
    let html = '';
    for (let row = 0; row < 2; row++) {
        html += '<div class="flex justify-center gap-2.5 sm:gap-3 md:gap-4">';
        for (let col = 0; col < perRow; col++) {
            const i = row * perRow + col + 1;
            if (i > total) break;
            const filled = i <= earned;
            const isLatest = i === earned && earned > 0 && earned < total;
            const delay = (i - 1) * 0.06;
            let cls = 'token-circle token-animate';
            if (filled) cls += ' token-filled';
            else cls += ' token-empty';
            if (isLatest) cls += ' token-latest';

            let inner = '';
            if (filled) {
                inner = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            } else {
                inner = `<span class="text-white/30">${i}</span>`;
            }

            // Tooltip for filled tokens
            const tkn = filled ? tokens.find(t => parseInt(t.token_position) === i) : null;
            if (tkn) {
                const tipLines = buildTokenTip(tkn, i);
                html += `<div class="token-tip ${cls}" style="animation-delay:${delay}s"><div class="tip-box">${tipLines}</div>${inner}</div>`;
            } else {
                html += `<div class="${cls}" style="animation-delay:${delay}s">${inner}</div>`;
            }
        }
        html += '</div>';
    }
    return html;
}

function buildTokenTip(tkn, pos) {
    let lines = `<div class="font-semibold" style="color:var(--primary);">Token #${pos}</div>`;
    lines += `<div>${formatDate(tkn.created_at)}</div>`;
    if (tkn.amount) lines += `<div>RM ${formatNumber(tkn.amount)}</div>`;
    if (tkn.plate_number) lines += `<div>${esc(tkn.plate_number)}</div>`;
    if (tkn.notes) lines += `<div class="text-gray-300">${esc(tkn.notes)}</div>`;
    return lines;
}

function renderQuickStats(earned, required, totalAmount, cardNum) {
    document.getElementById('qsTokens').textContent = earned;
    document.getElementById('qsTokensSub').textContent = `/ ${required}`;
    document.getElementById('qsRemaining').textContent = Math.max(0, required - earned);
    document.getElementById('qsSpent').textContent = 'RM ' + formatNumber(totalAmount || 0);
    document.getElementById('qsCard').textContent = cardNum ? `#${cardNum}` : '#-';
}

function renderTokenList(tokens) {
    const html = tokens.length ? tokens.map(t => tokenItemHtml(t)).join('') : '';
    document.getElementById('tokenListMobile').innerHTML = html;
    document.getElementById('tokenListDesktop').innerHTML = html;
    const noTkn = document.getElementById('noTokens');
    if (tokens.length === 0) noTkn.classList.remove('hidden');
    else noTkn.classList.add('hidden');
}

function tokenItemHtml(t) {
    const tokenData = encodeURIComponent(JSON.stringify(t));
    return `
        <div class="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all"
             onclick="showReceipt(JSON.parse(decodeURIComponent('${tokenData}')))">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm text-white shadow-sm"
                 style="background: linear-gradient(135deg, var(--primary), var(--secondary));">
                ${t.token_position}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">${esc(t.notes || 'Token')}</p>
                <p class="text-xs text-gray-400 mt-0.5">${formatDate(t.created_at)}${t.plate_number ? ' &middot; ' + esc(t.plate_number) : ''}</p>
            </div>
            ${t.amount ? `<span class="text-sm font-bold text-gray-700 whitespace-nowrap">RM ${parseFloat(t.amount).toFixed(2)}</span>` : ''}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
}

// ============================================
// HISTORY TAB
// ============================================
async function loadHistory() {
    try {
        const res = await api('history.php');
        if (!res.success) return;
        const { cards, redemptions, stats } = res;

        document.getElementById('hStatTokens').textContent = stats.total_tokens;
        document.getElementById('hStatRedeemed').textContent = stats.total_redemptions;
        document.getElementById('hStatCards').textContent = stats.total_cards;

        if (!cards || cards.length === 0) {
            document.getElementById('noHistory').classList.remove('hidden');
            document.getElementById('historyList').innerHTML = '';
            return;
        }
        document.getElementById('noHistory').classList.add('hidden');

        document.getElementById('historyList').innerHTML = cards.map(card => {
            const statusLabel = { active: 'Aktif', completed: 'Selesai', redeemed: 'Ditebus' }[card.status] || card.status;
            const badgeCls = `badge-${card.status}`;
            const redemption = redemptions[card.id];
            const pct = Math.round((card.tokens_earned / card.tokens_required) * 100);

            // Status icon
            let statusIcon = '';
            if (card.status === 'redeemed') {
                statusIcon = `<div class="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
            } else if (card.status === 'completed') {
                statusIcon = `<div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>`;
            } else {
                statusIcon = `<div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: color-mix(in srgb, var(--primary) 10%, transparent);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>`;
            }

            return `
                <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-3 mb-3">
                        ${statusIcon}
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-800 text-sm">Kad #${card.card_number}</p>
                            <p class="text-xs text-gray-400">${card.tokens_earned}/${card.tokens_required} tokens &middot; RM ${formatNumber(card.total_amount)}</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeCls}">${statusLabel}</span>
                    </div>
                    <!-- Mini tokens -->
                    <div class="flex flex-wrap gap-1 mb-3">
                        ${renderMiniTokens(card.tokens_earned, card.tokens_required, card.tokens)}
                    </div>
                    <!-- Progress bar mini -->
                    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div class="h-full rounded-full" style="width:${pct}%;background:linear-gradient(90deg, var(--primary), var(--secondary));"></div>
                    </div>
                    <div class="text-xs text-gray-400">
                        ${card.status === 'redeemed' && redemption
                            ? `<span class="text-emerald-600 font-semibold">Ganjaran: ${esc(redemption.reward_description)}</span> &middot; ${formatDate(redemption.redeemed_at)}`
                            : card.completed_at
                                ? `Selesai: ${formatDate(card.completed_at)}`
                                : `Dimulakan: ${formatDate(card.created_at)}`
                        }
                    </div>
                </div>`;
        }).join('');

    } catch (e) { console.error('loadHistory:', e); }
}

function renderMiniTokens(earned, total, tokens) {
    tokens = tokens || [];
    let html = '';
    for (let i = 1; i <= total; i++) {
        const filled = i <= earned;
        const tkn = filled ? tokens.find(t => parseInt(t.token_position) === i) : null;
        if (filled && tkn) {
            const tipLines = buildTokenTip(tkn, i);
            html += `<div class="mini-tip w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center cursor-pointer" style="background:var(--primary);">
                <div class="tip-box">${tipLines}</div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>`;
        } else if (filled) {
            html += `<div class="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center" style="background:var(--primary);">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>`;
        } else {
            html += `<div class="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-300">${i}</div>`;
        }
    }
    return html;
}

// ============================================
// PROFILE TAB
// ============================================
async function loadProfile() {
    try {
        const res = await api('profile.php');
        if (!res.success) return;

        profileData = res.user;
        vehiclesData = res.vehicles || [];
        updateHeader();

        const name = profileData.name || '-';
        const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        document.getElementById('pAvatar').textContent = initials;
        document.getElementById('pName').textContent = name;
        document.getElementById('pCode').textContent = profileData.user_code || '-';

        // Hero card info
        document.getElementById('pInfoPhone').textContent = profileData.phone || '-';
        const emailEl = document.getElementById('pInfoEmail');
        if (profileData.email) {
            emailEl.textContent = profileData.email;
            emailEl.className = 'text-white/90 text-sm font-medium truncate';
        } else {
            emailEl.textContent = 'Tidak ditetapkan';
            emailEl.className = 'text-white/40 text-sm italic truncate';
        }

        // Check if vehicle is required
        const requireVehicle = (settingsData.require_vehicle ?? '1') === '1';

        // Vehicle badges in hero card
        const vehicleBadgesRow = document.getElementById('pVehicleBadgesRow');
        const vehicleSectionWrapper = document.getElementById('vehicleSectionWrapper');
        const pStatVehiclesCol = document.getElementById('pStatVehiclesCol');
        const profileStatsBar = document.getElementById('profileStatsBar');

        const pStatTokensCol = document.getElementById('pStatTokensCol');

        if (requireVehicle) {
            // Show vehicle UI
            if (vehicleBadgesRow) vehicleBadgesRow.classList.remove('hidden');
            if (vehicleSectionWrapper) vehicleSectionWrapper.classList.remove('hidden');
            if (pStatVehiclesCol) pStatVehiclesCol.classList.remove('hidden');
            if (profileStatsBar) profileStatsBar.className = 'pt-4 border-t border-white/15 grid grid-cols-3 gap-2 text-center';
            if (pStatTokensCol) pStatTokensCol.className = 'border-l border-r border-white/15';
            renderVehicleBadges();
            document.getElementById('pStatVehicles').textContent = vehiclesData.length;
            document.getElementById('vehicleCount').textContent = vehiclesData.length;
            renderVehicles();
        } else {
            // Hide all vehicle UI
            if (vehicleBadgesRow) vehicleBadgesRow.classList.add('hidden');
            if (vehicleSectionWrapper) vehicleSectionWrapper.classList.add('hidden');
            if (pStatVehiclesCol) pStatVehiclesCol.classList.add('hidden');
            // Change stats grid from 3 to 2 columns, remove left border on Token col
            if (profileStatsBar) profileStatsBar.className = 'pt-4 border-t border-white/15 grid grid-cols-2 gap-2 text-center';
            if (pStatTokensCol) pStatTokensCol.className = 'border-r border-white/15';
        }

        // Get card stats
        try {
            const hRes = await api('history.php');
            if (hRes.success) {
                document.getElementById('pStatTokens').textContent = hRes.stats.total_tokens;
                document.getElementById('pStatCards').textContent = hRes.stats.total_redemptions || 0;
            }
        } catch {}

        // Edit form prefill
        document.getElementById('editName').value = profileData.name || '';
        document.getElementById('editPhone').value = profileData.phone || '';
        document.getElementById('editEmail').value = profileData.email || '';
    } catch (e) { console.error('loadProfile:', e); }
}

function renderVehicleBadges() {
    const container = document.getElementById('pVehicleBadges');
    if (!vehiclesData || vehiclesData.length === 0) {
        container.innerHTML = '<span class="text-white/40 text-xs italic">Tiada kenderaan</span>';
        return;
    }
    container.innerHTML = vehiclesData.map(v => {
        const isPrimary = v.is_primary;
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${isPrimary ? 'bg-white/25 text-white' : 'bg-white/10 text-white/70'}">
            ${isPrimary ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21 8 14 2 9.4h7.6z"/></svg>' : ''}
            ${esc(v.plate_number)}
        </span>`;
    }).join('');
}

function toggleSection(id) {
    const section = document.getElementById(id);
    const arrow = document.getElementById(id + 'Arrow');
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        section.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

function renderVehicles() {
    const list = document.getElementById('vehicleList');
    const noVeh = document.getElementById('noVehicles');

    if (!vehiclesData || vehiclesData.length === 0) {
        list.innerHTML = '';
        noVeh.classList.remove('hidden');
        return;
    }
    noVeh.classList.add('hidden');

    const typeLabels = { car: 'Kereta', suv: 'SUV', motorcycle: 'Motosikal', van: 'Van' };

    list.innerHTML = vehiclesData.map(v => `
        <div class="flex items-center gap-3 p-3.5 rounded-xl transition ${v.is_primary ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4' : 'bg-gray-50 hover:bg-gray-100'}"
             ${v.is_primary ? 'style="border-left-color: var(--primary);"' : ''}>
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.is_primary ? 'text-white shadow-md' : 'bg-white text-gray-400 shadow-sm'}"
                 ${v.is_primary ? 'style="background: linear-gradient(135deg, var(--primary), var(--secondary));"' : ''}>
                ${v.vehicle_type === 'motorcycle'
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17h7M5 14l4-7h4l3 7"/></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>'
                }
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-800 text-sm tracking-wide">${esc(v.plate_number)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${typeLabels[v.vehicle_type] || v.vehicle_type}${v.vehicle_model ? ' &middot; ' + esc(v.vehicle_model) : ''}</p>
            </div>
            ${v.is_primary ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:var(--primary);">Utama</span>` : ''}
            ${vehiclesData.length > 1 ? `
                <button onclick="removeVehicle(${v.id}, '${esc(v.plate_number)}')" class="w-8 h-8 rounded-lg flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>` : ''}
        </div>`).join('');
}

// ============================================
// Save Profile
// ============================================
async function saveProfile() {
    const name = document.getElementById('editName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    if (!name) { showToast('Nama diperlukan', 'error'); return; }

    showLoading();
    try {
        const res = await api('profile.php', 'POST', { name, phone, email });
        if (res.success) {
            showToast(res.message);
            loadProfile();
            // Collapse edit section after save
            const editSection = document.getElementById('editSection');
            const editArrow = document.getElementById('editSectionArrow');
            if (editSection && !editSection.classList.contains('hidden')) {
                editSection.classList.add('hidden');
                if (editArrow) editArrow.style.transform = 'rotate(0deg)';
            }
        } else { showToast(res.message || 'Ralat', 'error'); }
    } catch { showToast('Ralat sambungan', 'error'); }
    hideLoading();
}

// ============================================
// Vehicles
// ============================================
function selectVehicleType(type) {
    selectedVehicleType = type;
    document.getElementById('addVehicleType').value = type;
    document.querySelectorAll('.vtype-btn').forEach(btn => {
        btn.classList.remove('vtype-active');
        btn.classList.add('border-gray-200', 'text-gray-400');
    });
    const btns = document.querySelectorAll('.vtype-btn');
    const idx = type === 'car' ? 0 : 1;
    if (btns[idx]) {
        btns[idx].classList.add('vtype-active');
        btns[idx].classList.remove('border-gray-200', 'text-gray-400');
    }
}

function openAddVehicle() {
    document.getElementById('addPlate').value = '';
    document.getElementById('addVehicleModel').value = '';
    selectVehicleType('car');
    openModal('addVehicleModal');
}

async function saveVehicle() {
    const plate = document.getElementById('addPlate').value.trim();
    const type = document.getElementById('addVehicleType').value;
    const model = document.getElementById('addVehicleModel').value.trim();
    if (!plate || plate.length < 2) { showToast('Nombor plat diperlukan', 'error'); return; }

    showLoading();
    try {
        const res = await api('vehicles.php', 'POST', { action: 'add', plate_number: plate, vehicle_type: type, vehicle_model: model });
        if (res.success) {
            showToast(res.message);
            vehiclesData = res.vehicles || [];
            renderVehicles();
            renderVehicleBadges();
            document.getElementById('pStatVehicles').textContent = vehiclesData.length;
            document.getElementById('vehicleCount').textContent = vehiclesData.length;
            closeModal('addVehicleModal');
        } else { showToast(res.message || 'Ralat', 'error'); }
    } catch { showToast('Ralat sambungan', 'error'); }
    hideLoading();
}

async function removeVehicle(id, plate) {
    if (!confirm(`Buang kenderaan ${plate}?`)) return;
    showLoading();
    try {
        const res = await api('vehicles.php', 'POST', { action: 'remove', vehicle_id: id });
        if (res.success) {
            showToast(res.message);
            vehiclesData = res.vehicles || [];
            renderVehicles();
            renderVehicleBadges();
            document.getElementById('pStatVehicles').textContent = vehiclesData.length;
            document.getElementById('vehicleCount').textContent = vehiclesData.length;
        } else { showToast(res.message || 'Ralat', 'error'); }
    } catch { showToast('Ralat sambungan', 'error'); }
    hideLoading();
}

// ============================================
// Modals
// ============================================
function openModal(id) {
    const el = document.getElementById(id);
    el.classList.remove('hidden'); el.classList.add('flex');
}
function closeModal(id) {
    const el = document.getElementById(id);
    el.classList.add('hidden'); el.classList.remove('flex');
}

document.querySelectorAll('[id$="Modal"]').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) { this.classList.add('hidden'); this.classList.remove('flex'); }
    });
});

// ============================================
// Utilities
// ============================================
function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatNumber(n) {
    if (n === null || n === undefined) return '0.00';
    return parseFloat(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================
// RECEIPT MODAL
// ============================================
let currentReceiptData = null;

function showReceipt(token) {
    currentReceiptData = token;
    const s = settingsData;
    const currency = s.currency_symbol || 'RM';
    const primaryColor = s.primary_color || '#6366f1';
    const bizName = s.business_name || 'Business';

    // Format date/time
    const dt = new Date(token.created_at);
    const day = dt.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    const dateStr = `${day} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    const hours = dt.getHours();
    const mins = dt.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const timeStr = `${h12}:${mins} ${ampm}`;
    const receiptNo = `TKN-${token.id}`;

    // Get card progress from current card data
    const qsTokens = document.getElementById('qsTokens');
    const qsTokensSub = document.getElementById('qsTokensSub');
    const earned = qsTokens ? parseInt(qsTokens.textContent) || 0 : 0;
    const required = qsTokensSub ? parseInt(qsTokensSub.textContent.replace('/ ', '')) || 10 : 10;
    const progressPct = Math.min(Math.round((earned / required) * 100), 100);

    let html = '';

    // ─── Business Header ───
    html += '<div class="text-center mb-4">';
    if (s.business_logo) {
        html += `<img src="${s.business_logo}" alt="${esc(bizName)}" class="w-14 h-14 object-contain mx-auto mb-2 rounded-xl" crossorigin="anonymous">`;
    }
    html += `<h2 class="font-bold text-base text-gray-900">${esc(bizName)}</h2>`;
    if (s.business_address) {
        html += `<p class="text-[11px] text-gray-400 mt-0.5 leading-tight">${esc(s.business_address)}</p>`;
    }
    if (s.business_phone) {
        html += `<p class="text-[11px] text-gray-400">Tel: ${esc(s.business_phone)}</p>`;
    }
    html += '</div>';

    // ─── Separator ───
    html += `<div class="flex items-center gap-2 mb-4">
        <div class="flex-1 border-t border-dashed border-gray-200"></div>
        <span class="text-[10px] text-gray-300 font-medium tracking-widest uppercase">Resit</span>
        <div class="flex-1 border-t border-dashed border-gray-200"></div>
    </div>`;

    // ─── Receipt Details ───
    html += '<div class="space-y-2 text-sm">';
    html += receiptRow('No. Resit', receiptNo);
    html += receiptRow('Tarikh', dateStr);
    html += receiptRow('Masa', timeStr);
    if (token.staff_name) html += receiptRow('Staff', esc(token.staff_name));
    html += '</div>';

    // ─── Amount Card ───
    if (token.amount && parseFloat(token.amount) > 0) {
        html += `<div class="mt-4 rounded-xl p-4 text-center" style="background-color: ${primaryColor}0A;">
            <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Jumlah</p>
            <p class="text-2xl font-bold text-gray-900">${currency} ${formatNumber(token.amount)}</p>
        </div>`;
    }

    // ─── Service / Notes / Vehicle ───
    if (token.notes || token.plate_number) {
        html += '<div class="mt-4 space-y-2 text-sm">';
        if (token.notes) html += receiptRow('Servis', esc(token.notes));
        if (token.plate_number) html += receiptRow('Kenderaan', esc(token.plate_number));
        html += '</div>';
    }

    // ─── Loyalty Progress ───
    html += `<div class="mt-4 bg-gray-50 rounded-xl p-3.5">
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500 font-medium">Progres Kesetiaan</span>
            <span class="text-xs font-bold" style="color: ${primaryColor};">${earned}/${required}</span>
        </div>
        <div class="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700" style="background-color: ${primaryColor}; width: ${progressPct}%;"></div>
        </div>`;
    if (earned < required) {
        html += `<p class="text-[11px] text-gray-400 mt-1.5 text-center">${required - earned} lagi untuk ganjaran anda!</p>`;
    } else {
        html += `<p class="text-[11px] font-medium mt-1.5 text-center" style="color: ${primaryColor};">Kad lengkap! Tebus ganjaran anda!</p>`;
    }
    html += '</div>';

    // ─── Footer ───
    html += `<div class="mt-5 text-center">
        <div class="flex items-center gap-2 mb-2">
            <div class="flex-1 border-t border-dashed border-gray-200"></div>
            <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${primaryColor}40;"></div>
            <div class="flex-1 border-t border-dashed border-gray-200"></div>
        </div>
        <p class="text-sm font-semibold text-gray-700">Terima kasih atas kunjungan anda!</p>
        <p class="text-[11px] text-gray-400 mt-0.5">${esc(bizName)}</p>
        <p class="text-[10px] text-gray-300 mt-0.5">${dateStr} ${timeStr}</p>
    </div>`;

    document.getElementById('receiptContent').innerHTML = html;

    // Reset PDF button state
    const pdfBtn = document.getElementById('receiptPdfBtn');
    pdfBtn.querySelector('span').textContent = 'PDF';
    pdfBtn.style.borderColor = 'var(--primary)';
    pdfBtn.style.color = 'var(--primary)';
    pdfBtn.style.background = 'transparent';
    pdfBtn.disabled = false;

    openModal('receiptModal');
}

function receiptRow(label, value) {
    return `<div class="flex justify-between items-start gap-3">
        <span class="text-gray-400 text-xs shrink-0">${label}</span>
        <span class="text-right text-gray-800 font-medium text-xs break-words min-w-0">${value}</span>
    </div>`;
}

// ─── Receipt URL ───
function getReceiptUrl(tokenId) {
    const base = window.location.pathname.replace(/\/?(\?.*)?$/, '/');
    return window.location.origin + base + 'resit.php?id=' + tokenId;
}

// ─── WhatsApp Share (with URL) ───
function shareReceiptWhatsApp() {
    if (!currentReceiptData) return;
    const t = currentReceiptData;
    const s = settingsData;
    const currency = s.currency_symbol || 'RM';
    const bizName = s.business_name || 'Business';
    const url = getReceiptUrl(t.id);

    const dt = new Date(t.created_at);
    const day = dt.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    const dateStr = `${day} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    const h = dt.getHours(), m = dt.getMinutes().toString().padStart(2, '0');
    const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;

    const qsTokens = document.getElementById('qsTokens');
    const qsTokensSub = document.getElementById('qsTokensSub');
    const earned = qsTokens ? parseInt(qsTokens.textContent) || 0 : 0;
    const required = qsTokensSub ? parseInt(qsTokensSub.textContent.replace('/ ', '')) || 10 : 10;

    let text = `🧾 *RESIT - ${bizName}*\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `📋 No. Resit: TKN-${t.id}\n`;
    text += `📅 Tarikh: ${dateStr}\n`;
    text += `🕐 Masa: ${timeStr}\n`;
    if (t.staff_name) text += `👤 Staff: ${t.staff_name}\n`;
    if (t.amount && parseFloat(t.amount) > 0) {
        text += `━━━━━━━━━━━━━━━\n`;
        text += `💰 Jumlah: *${currency} ${formatNumber(t.amount)}*\n`;
    }
    if (t.notes) text += `🔧 Servis: ${t.notes}\n`;
    if (t.plate_number) text += `🚗 Kenderaan: ${t.plate_number}\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `⭐ Progres: ${earned}/${required} token\n`;
    if (earned < required) {
        text += `📌 ${required - earned} lagi untuk ganjaran!\n`;
    } else {
        text += `🎉 Kad lengkap! Tebus ganjaran!\n`;
    }
    text += `━━━━━━━━━━━━━━━\n`;
    text += `Terima kasih! 🙏\n`;
    text += `${bizName}\n\n`;
    text += `🔗 Lihat resit penuh:\n${url}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

// ─── PDF Download (A5) ───
async function downloadReceiptPDF() {
    if (!currentReceiptData) return;
    const btn = document.getElementById('receiptPdfBtn');
    const span = btn.querySelector('span');
    btn.disabled = true;
    btn.style.opacity = '0.7';
    span.textContent = 'Menjana...';

    try {
        // Check html2canvas
        if (typeof html2canvas === 'undefined') throw new Error('html2canvas not loaded');

        // Dynamically load jsPDF if not yet loaded
        if (!window.jspdf) {
            await new Promise((resolve, reject) => {
                const sc = document.createElement('script');
                sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                sc.onload = resolve;
                sc.onerror = () => reject(new Error('jsPDF gagal dimuat'));
                document.head.appendChild(sc);
            });
        }

        const t = currentReceiptData;
        const s = settingsData;
        const currency = s.currency_symbol || 'RM';
        const primary = s.primary_color || '#6366f1';
        const secondary = s.secondary_color || '#8b5cf6';
        const bizName = s.business_name || 'Business';

        const dt = new Date(t.created_at);
        const day = dt.getDate().toString().padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
        const dateStr = `${day} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
        const h = dt.getHours(), m = dt.getMinutes().toString().padStart(2, '0');
        const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
        const receiptNo = `TKN-${t.id}`;

        const qsTokens = document.getElementById('qsTokens');
        const qsTokensSub = document.getElementById('qsTokensSub');
        const earned = qsTokens ? parseInt(qsTokens.textContent) || 0 : 0;
        const required = qsTokensSub ? parseInt(qsTokensSub.textContent.replace('/ ', '')) || 10 : 10;
        const pct = Math.min(Math.round((earned / required) * 100), 100);
        const remaining = Math.max(0, required - earned);

        const receiptUrl = getReceiptUrl(t.id);

        // Convert logo to base64 first to avoid CORS issues
        let logoBase64 = '';
        if (s.business_logo) {
            try {
                const logoResp = await fetch(s.business_logo);
                const logoBlob = await logoResp.blob();
                logoBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
            } catch (e) { console.warn('Logo fetch failed, skip:', e); }
        }

        // Build A5 receipt HTML
        let pdf = '';
        pdf += `<div style="padding:40px 36px; color:#1f2937; font-family:Inter,system-ui,sans-serif; font-size:13px; line-height:1.5;">`;

        // Gradient header
        pdf += `<div style="background:linear-gradient(135deg,${primary},${secondary}); border-radius:16px; padding:28px 24px; text-align:center; color:white; position:relative; overflow:hidden; margin-bottom:28px;">`;
        pdf += `<div style="position:absolute; top:-20px; right:-20px; width:80px; height:80px; background:rgba(255,255,255,0.1); border-radius:50%;"></div>`;
        pdf += `<div style="position:absolute; bottom:-16px; left:-16px; width:60px; height:60px; background:rgba(255,255,255,0.08); border-radius:50%;"></div>`;
        if (logoBase64) {
            pdf += `<img src="${logoBase64}" style="width:56px; height:56px; object-fit:contain; margin:0 auto 10px; border-radius:14px; background:rgba(255,255,255,0.2); padding:6px; display:block;">`;
        }
        pdf += `<div style="font-size:18px; font-weight:800; letter-spacing:-0.3px;">${esc(bizName)}</div>`;
        if (s.business_address) pdf += `<div style="font-size:10px; opacity:0.7; margin-top:4px;">${esc(s.business_address)}</div>`;
        if (s.business_phone) pdf += `<div style="font-size:10px; opacity:0.6;">Tel: ${esc(s.business_phone)}</div>`;
        pdf += `</div>`;

        // Receipt label
        pdf += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">`;
        pdf += `<div style="flex:1; height:1px; background:#e5e7eb;"></div>`;
        pdf += `<span style="font-size:9px; font-weight:700; color:#d1d5db; letter-spacing:3px; text-transform:uppercase;">RESIT TRANSAKSI</span>`;
        pdf += `<div style="flex:1; height:1px; background:#e5e7eb;"></div>`;
        pdf += `</div>`;

        // Details rows
        const row = (l, v, bold) => `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#9ca3af; font-size:12px;">${l}</span><span style="font-size:12px; font-weight:${bold ? '700' : '600'}; color:${bold ? '#111827' : '#374151'};">${v}</span></div>`;
        pdf += row('No. Resit', receiptNo, true);
        pdf += row('Tarikh', dateStr);
        pdf += row('Masa', timeStr);
        if (t.staff_name) pdf += row('Staff', esc(t.staff_name));

        // Amount
        if (t.amount && parseFloat(t.amount) > 0) {
            pdf += `<div style="margin-top:20px; border-radius:14px; padding:20px; text-align:center; background:${primary}0A; border:1px solid ${primary}20;">`;
            pdf += `<div style="font-size:9px; color:#9ca3af; text-transform:uppercase; letter-spacing:3px; font-weight:600; margin-bottom:4px;">Jumlah</div>`;
            pdf += `<div style="font-size:28px; font-weight:900; color:#111827;">${currency} ${formatNumber(t.amount)}</div>`;
            pdf += `</div>`;
        }

        // Service / Vehicle
        if (t.notes || t.plate_number) {
            pdf += `<div style="margin-top:16px;">`;
            if (t.notes) pdf += row('Servis', esc(t.notes));
            if (t.plate_number) pdf += row('Kenderaan', esc(t.plate_number), true);
            pdf += `</div>`;
        }

        // Progress
        pdf += `<div style="margin-top:20px; background:#f9fafb; border-radius:14px; padding:16px;">`;
        pdf += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">`;
        pdf += `<span style="font-size:11px; font-weight:600; color:#6b7280;">Progres Kesetiaan</span>`;
        pdf += `<span style="font-size:11px; font-weight:800; color:${primary};">${earned}/${required}</span>`;
        pdf += `</div>`;
        pdf += `<div style="width:100%; height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">`;
        pdf += `<div style="width:${pct}%; height:100%; background:${primary}; border-radius:5px;"></div>`;
        pdf += `</div>`;
        if (earned < required) {
            pdf += `<div style="font-size:10px; color:#9ca3af; text-align:center; margin-top:8px;">${remaining} lagi untuk ganjaran anda!</div>`;
        } else {
            pdf += `<div style="font-size:10px; font-weight:700; color:${primary}; text-align:center; margin-top:8px;">Kad lengkap! Tebus ganjaran anda!</div>`;
        }
        pdf += `</div>`;

        // Footer
        pdf += `<div style="margin-top:24px; text-align:center;">`;
        pdf += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">`;
        pdf += `<div style="flex:1; border-top:1px dashed #e5e7eb;"></div>`;
        pdf += `<div style="width:6px; height:6px; border-radius:50%; background:${primary}30;"></div>`;
        pdf += `<div style="flex:1; border-top:1px dashed #e5e7eb;"></div>`;
        pdf += `</div>`;
        pdf += `<div style="font-size:13px; font-weight:700; color:#374151;">Terima kasih atas kunjungan anda!</div>`;
        pdf += `<div style="font-size:10px; color:#9ca3af; margin-top:4px;">${esc(bizName)}</div>`;
        pdf += `<div style="font-size:9px; color:#d1d5db; margin-top:2px;">${dateStr} ${timeStr}</div>`;
        pdf += `</div>`;

        // URL
        pdf += `<div style="margin-top:20px; text-align:center; padding:10px; background:#f9fafb; border-radius:10px;">`;
        pdf += `<div style="font-size:8px; color:#9ca3af; margin-bottom:2px;">Lihat resit dalam talian:</div>`;
        pdf += `<div style="font-size:8px; color:${primary}; word-break:break-all;">${esc(receiptUrl)}</div>`;
        pdf += `</div>`;

        pdf += `</div>`;

        // Render to hidden div
        const pdfEl = document.getElementById('receiptPdfContent');
        pdfEl.innerHTML = pdf;

        // Small delay for render
        await new Promise(r => setTimeout(r, 100));

        // Capture to canvas
        const canvas = await html2canvas(pdfEl, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
        });

        // Create A5 PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
        const a5w = 148, a5h = 210;
        const imgData = canvas.toDataURL('image/png');
        const ratio = canvas.height / canvas.width;
        const imgW = a5w;
        const imgH = imgW * ratio;

        doc.addImage(imgData, 'PNG', 0, 0, imgW, Math.min(imgH, a5h));
        doc.save(`resit-${receiptNo}.pdf`);

        // Success state
        span.textContent = 'Dimuat turun!';
        btn.style.background = '#22c55e';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#fff';
        btn.style.opacity = '1';
        setTimeout(() => {
            span.textContent = 'PDF';
            btn.style.background = 'transparent';
            btn.style.borderColor = 'var(--primary)';
            btn.style.color = 'var(--primary)';
            btn.disabled = false;
        }, 2000);

    } catch (e) {
        console.error('downloadReceiptPDF error:', e);
        span.textContent = 'PDF';
        btn.style.opacity = '1';
        btn.disabled = false;
        showToast('Gagal menjana PDF: ' + e.message, 'error');
    }
}
