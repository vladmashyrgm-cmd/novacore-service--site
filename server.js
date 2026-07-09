const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Použití parseru pro zpracování JSON požadavků z frontendu
app.use(bodyParser.json());

// Inicializace SQLite databáze
const db = new sqlite3.Database('./databaze.sqlite', (err) => {
    if (err) console.error('Chyba databáze:', err.message);
    else console.log('Připojeno k SQLite databázi.');
});

// Vytvoření tabulek pro trvalé uložení uživatelů a dat z administrace
db.serialize(() => {
    // Tabulka uživatelů (registrace a přihlášení)
    db.run(`CREATE TABLE IF NOT EXISTS uzivatele (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL
    )`);

    // Tabulka pro admin nastavení (klíč -> hodnota)
    db.run(`CREATE TABLE IF NOT EXISTS admin_nastaveni (
        klic TEXT PRIMARY KEY,
        hodnota TEXT
    )`);
});

// --- API ENDPOINTY PRO UKLÁDÁNÍ A NAČÍTÁNÍ DATA ---

// Registrace uživatele do databáze
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    db.run(`INSERT INTO uzivatele (username, password) VALUES (?, ?)`, [username, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.json({ success: false, error: 'exists' });
            }
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});

// Přihlášení uživatele z databáze
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT password FROM uzivatele WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ success: false });
        if (row && row.password === password) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
});

// Uložení kompletního nastavení z administrátorského panelu
app.post('/api/admin/save', (req, res) => {
    const settings = req.body; // Objekt klíč: hodnota
    const stmt = db.prepare(`INSERT OR REPLACE INTO admin_nastaveni (klic, hodnota) VALUES (?, ?)`);
    
    db.serialize(() => {
        for (const [klic, hodnota] of Object.entries(settings)) {
            stmt.run(klic, JSON.stringify(hodnota));
        }
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
});

// Načtení nastavení administrátora při startu stránky
app.get('/api/admin/load', (req, res) => {
    db.all(`SELECT klic, hodnota FROM admin_nastaveni`, [], (err, rows) => {
        if (err) return res.status(500).json({});
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.klic] = JSON.parse(row.hodnota);
            } catch(e) {
                settings[row.klic] = row.hodnota;
            }
        });
        res.json(settings);
    });
});

// --- DOSAZENÍ TVÉHO HTML WEBU JAKO HLAVNÍ STRÁNKY ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Discord Studio 2026</title>

<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<style>
:root {
    --bg: #0e1118;
    --card: rgba(27, 32, 46, 0.7);
    --blue: #5865F2;
    --green: #23a55a;
    --text: #e3e5e8;
    --accent: #00f2fe;
    --glass-border: rgba(255, 255, 255, 0.05);
    --neon-glow: 0 0 15px rgba(88, 101, 242, 0.6);
}

[data-theme="light"] {
    --bg: #f4f6f9;
    --card: rgba(255, 255, 255, 0.7);
    --blue: #5865F2;
    --green: #23a55a;
    --text: #11141c;
    --accent: #ff007f;
    --glass-border: rgba(0, 0, 0, 0.05);
    --neon-glow: 0 0 15px rgba(88, 101, 242, 0.3);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    transition: background 0.3s, color 0.3s;
}

body {
    background: var(--bg);
    color: var(--text);
    overflow-x: hidden;
}

#particle-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
}

.custom-cursor {
    width: 20px;
    height: 20px;
    border: 2px solid var(--blue);
    border-radius: 50%;
    position: fixed;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 100000;
    transition: width 0.2s, height 0.2s, background-color 0.2s;
}
.custom-cursor-dot {
    width: 4px;
    height: 4px;
    background: var(--accent);
    border-radius: 50%;
    position: fixed;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 100000;
}

#loader {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0e1118;
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    transition: opacity 0.4s ease, visibility 0.4s;
}
.spinner {
    width: 50px;
    height: 50px;
    border: 5px solid rgba(88, 101, 242, 0.2);
    border-top: 5px solid var(--blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 50px;
    background: rgba(17, 20, 28, 0.7);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--glass-border);
    position: sticky;
    top: 0;
    z-index: 100;
}
.logo {
    font-size: 28px;
    font-weight: bold;
    background: linear-gradient(45deg, #fff, var(--blue));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
nav {
    display: flex;
    align-items: center;
    gap: 12px;
}
.nav-btn {
    padding: 10px 18px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: var(--blue);
    color: white;
    font-weight: bold;
    transition: 0.3s;
    box-shadow: var(--neon-glow);
}
.nav-btn:hover {
    transform: translateY(-3px);
    filter: brightness(1.2);
}
.nav-btn.secondary {
    background: var(--card);
    border: 1px solid var(--glass-border);
    color: var(--text);
    box-shadow: none;
}
.theme-toggle, .lang-select {
    background: var(--card);
    border: 1px solid var(--glass-border);
    color: var(--text);
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
}

.hero {
    text-align: center;
    padding: 120px 20px 80px 20px;
}
.hero h1 {
    font-size: 55px;
    margin-bottom: 20px;
    background: linear-gradient(90deg, #fff, var(--blue), var(--accent));
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shine 4s linear infinite;
}
@keyframes shine { to { background-position: 200% center; } }
.hero p {
    font-size: 20px;
    color: #aaa;
    max-width: 700px;
    margin: auto;
}

.stats-container {
    display: flex;
    justify-content: center;
    gap: 50px;
    padding: 30px;
    margin-bottom: 40px;
    flex-wrap: wrap;
}
.stat-box {
    text-align: center;
    background: var(--card);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    padding: 20px 40px;
    border-radius: 15px;
    min-width: 180px;
}
.stat-number {
    font-size: 35px;
    font-weight: bold;
    color: var(--accent);
}

.pricing {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 25px;
    padding: 50px 20px;
}
.card {
    width: 280px;
    background: var(--card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 30px 25px;
    border-radius: 24px;
    border: 1px solid var(--glass-border);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, border-color 0.3s;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.card:hover {
    transform: translateY(-12px);
    border-color: var(--blue);
    box-shadow: var(--neon-glow);
}
.card.featured {
    border-color: var(--accent);
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);
}
.card h2 {
    text-align: center;
    margin-bottom: 15px;
    font-size: 24px;
}
.price {
    font-size: 36px;
    text-align: center;
    font-weight: bold;
    margin-bottom: 20px;
    color: #fff;
    text-shadow: 0 0 10px rgba(255,255,255,0.2);
}
[data-theme="light"] .price { color: var(--text); }
.features {
    list-style: none;
    margin-bottom: 25px;
    flex-grow: 1;
}
.features li {
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
}
.buy {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 14px;
    background: var(--blue);
    color: white;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.3s;
    box-shadow: 0 4px 15px rgba(88, 101, 242, 0.4);
}
.buy:hover {
    background: #4752c4;
    box-shadow: 0 6px 20px rgba(88, 101, 242, 0.6);
}

.faq-section {
    max-width: 800px;
    margin: 60px auto;
    padding: 0 20px;
}
.faq-section h2 { text-align: center; margin-bottom: 30px; }
.faq-item {
    background: var(--card);
    border: 1px solid var(--glass-border);
    margin-bottom: 15px;
    border-radius: 12px;
    overflow: hidden;
}
.faq-question {
    padding: 20px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.faq-answer {
    padding: 0 20px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease;
    color: #aaa;
}

.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
    justify-content: center; align-items: center;
    z-index: 200;
}
.modal-content {
    background: var(--card);
    border: 1px solid var(--glass-border);
    padding: 40px;
    border-radius: 24px;
    width: 100%;
    max-width: 500px;
    position: relative;
    box-shadow: var(--neon-glow);
}
.modal-content h2 { margin-bottom: 20px; }
.modal-content input, .modal-content textarea {
    width: 100%;
    padding: 12px;
    margin-top: 5px;
    margin-bottom: 15px;
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    background: rgba(0,0,0,0.2);
    color: var(--text);
}

.toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
}
.toast {
    background: var(--green);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    margin-top: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease forwards;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.admin-panel {
    display: none;
    position: fixed;
    top: 0; right: 0;
    width: 450px; height: 100%;
    background: #161a22;
    color: #e3e5e8;
    overflow-y: auto;
    padding: 30px;
    box-shadow: -5px 0 25px rgba(0,0,0,0.6);
    z-index: 999;
}
.admin-panel input, .admin-panel textarea {
    width: 100%; padding: 10px;
    margin: 8px 0;
    border: none; border-radius: 8px; background: #11141c; color: white;
}
.admin-panel button {
    margin-top: 15px;
    width: 100%; padding: 14px;
    border: none; background: var(--green); color: white;
    font-weight: bold; border-radius: 10px; cursor: pointer;
}
.closeAdmin { background: #c0392b !important; }

.loginBox {
    display: none; position: fixed;
    top: 0; left: 0; width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    justify-content: center; align-items: center; z-index: 9999;
}
.loginContent { background: #1b202e; padding: 40px; border-radius: 20px; width: 350px;
    text-align: center;}
.loginContent input { width: 100%; padding: 15px; margin: 15px 0; border: none; border-radius: 10px; background: #11141c;
    color: white;}
.loginContent button { width: 100%; padding: 15px; border: none; border-radius: 10px; background: var(--blue); color: white; font-weight: bold;
    cursor: pointer;}

@media (max-width: 768px) {
    header { padding: 20px; flex-direction: column; gap: 15px; }
    .hero h1 { font-size: 38px; }
    .pricing { padding: 20px; }
    .admin-panel { width: 100%; }
}
</style>
</head>
<body>

<canvas id="particle-canvas"></canvas>

<div class="custom-cursor" id="cursor"></div>
<div class="custom-cursor-dot" id="cursor-dot"></div>

<div id="loader">
    <div class="spinner"></div>
    <p style="margin-top: 15px; color: #5865F2; font-weight: bold;">Loading Studio...</p>
</div>

<div class="toast-container" id="toastContainer"></div>

<header>
    <div class="logo">Discord Studio</div>
    <nav>
        <select class="lang-select" id="langSelect" onchange="changeLanguage(this.value)">
            <option value="cs">🇨🇿 CZ</option>
            <option value="en">🇬🇧 EN</option>
            <option value="de">🇩🇪 DE</option>
            <option value="sk">🇸🇰 SK</option>
            <option value="pl">🇵🇱 PL</option>
        </select>
        <button class="theme-toggle" onclick="toggleTheme()"><i class="fas fa-moon"></i></button>
        
        <div id="authMenu" style="display: flex; gap: 10px;">
            <button class="nav-btn secondary" id="navLoginBtn" onclick="openAuthModal('login')">Přihlásit se</button>
            <button class="nav-btn" id="navRegisterBtn" onclick="openAuthModal('register')">Registrace</button>
        </div>
        <div id="userMenu" style="display: none; align-items: center; gap: 10px;">
            <span id="welcomeText" style="font-weight: bold; color: var(--accent);"></span>
            <button class="nav-btn secondary" id="navLogoutBtn" onclick="logoutUser()">Odhlásit</button>
        </div>

        <button class="nav-btn" style="background:#2c2f33;" id="navAdminBtn" onclick="openAdminLogin()">Admin</button>
    </nav>
</header>

<section class="hero" data-aos="zoom-in">
    <h1 id="heroTitle">Vytvoř si profesionální Discord server</h1>
    <p id="heroText">Kompletní tvorba Discord serverů, botů a automatizace na míru.</p>
</section>

<div class="stats-container" data-aos="fade-up">
    <div class="stat-box">
        <div class="stat-number" id="stat1">200+</div>
        <div id="statLabel1">Serverů</div>
    </div>
    <div class="stat-box">
        <div class="stat-number" id="stat2">50+</div>
        <div id="statLabel2">Vlastních botů</div>
    </div>
    <div class="stat-box">
        <div class="stat-number" id="stat3">99%</div>
        <div id="statLabel3">Spokojenost</div>
    </div>
</div>

<section class="pricing">
    <div class="card" data-aos="fade-up" data-aos-delay="100">
        <h2 id="name1">Start</h2>
        <div class="price" id="price1">300 Kč</div>
        <ul class="features" id="features1"></ul>
        <button class="buy btn-order" onclick="openOrderModal('Start')">Objednat</button>
    </div>

    <div class="card" data-aos="fade-up" data-aos-delay="200">
        <h2 id="name2">Medium</h2>
        <div class="price" id="price2">750 Kč</div>
        <ul class="features" id="features2"></ul>
        <button class="buy btn-order" onclick="openOrderModal('Medium')">Objednat</button>
    </div>

    <div class="card featured" data-aos="fade-up" data-aos-delay="300">
        <h2 id="name3">Pro</h2>
        <div class="price" id="price3">1500 Kč</div>
        <ul class="features" id="features3"></ul>
        <button class="buy btn-order" style="background: linear-gradient(45deg, var(--blue), var(--accent));" onclick="openOrderModal('Pro')">Objednat</button>
    </div>

    <div class="card" data-aos="fade-up" data-aos-delay="400">
        <h2 id="name4">Ultra</h2>
        <div class="price" id="price4">3000 Kč</div>
        <ul class="features" id="features4"></ul>
        <button class="buy btn-order" onclick="openOrderModal('Ultra')">Objednat</button>
    </div>
</section>

<section class="faq-section" data-aos="fade-up">
    <h2 id="faqTitle">Často kladené otázky</h2>
    <div id="faqContainer"></div>
</section>

<div class="modal" id="authModal">
    <div class="modal-content" style="max-width: 400px;">
        <h2 id="authModalTitle">Přihlášení</h2>
        <input type="text" id="authUsername" placeholder="Uživatelské jméno" required>
        <input type="password" id="authPassword" placeholder="Heslo" required>
        <button class="buy" id="authSubmitBtn" onclick="handleAuthSubmit()">Pokračovat</button>
        <button class="buy closeAdmin" id="authCancelBtn" style="margin-top:10px;" onclick="closeAuthModal()">Zrušit</button>
    </div>
</div>

<div class="modal" id="orderModal">
    <div class="modal-content">
        <h2 id="modalTitle">Objednávka balíčku</h2>
        <input type="hidden" id="selectedPackage">
        <label id="lblOrderName">Jméno / Nick</label>
        <input type="text" id="orderName" required>
        <label id="lblOrderDiscord">Discord Tag / ID</label>
        <input type="text" id="orderDiscord" required>
        <label id="lblOrderEmail">E-mail</label>
        <input type="email" id="orderEmail" required>
        <label id="lblOrderDetails">Co chceš vytvořit (detaily)</label>
        <textarea id="orderDetails" rows="3" required></textarea>
        <label id="lblOrderNote">Poznámka</label>
        <textarea id="orderNote" rows="2"></textarea>
        <button class="buy" id="orderSubmitBtn" onclick="submitOrder()">Pokračovat</button>
        <button class="buy closeAdmin" id="orderCancelBtn" style="margin-top:10px;" onclick="closeOrderModal()">Zrušit</button>
    </div>
</div>

<div class="loginBox" id="loginBox">
    <div class="loginContent">
        <h2 id="lblAdminTitle">Administrátor</h2>
        <input type="text" id="adminUser" placeholder="Uživatelské jméno">
        <input type="password" id="adminPass" placeholder="Heslo">
        <button onclick="loginAdmin()" id="adminLoginBtn">Přihlásit se</button>
        <button class="buy closeAdmin" style="margin-top:15px;" id="adminCloseBtn" onclick="closeLogin()">Zavřít</button>
    </div>
</div>

<div class="admin-panel" id="adminPanel">
    <h2>Administrace</h2>
    <div style="max-height: 80vh; overflow-y: auto; padding-right: 5px;">
        <h3>Ceník & Texty</h3>
        <label>Balíček 1 Název / Cena</label>
        <input id="editName1"><input id="editPrice1">
        <label>Balíček 2 Název / Cena</label>
        <input id="editName2"><input id="editPrice2">
        <label>Balíček 3 Název / Cena</label>
        <input id="editName3"><input id="editPrice3">
        <label>Balíček 4 Název / Cena</label>
        <input id="editName4"><input id="editPrice4">

        <h3>Statistiky</h3>
        <input id="editStat1" placeholder="Statistika 1"><input id="editStatLabel1" placeholder="Popisek 1">
        <input id="editStat2" placeholder="Statistika 2"><input id="editStatLabel2" placeholder="Popisek 2">

        <h3>Integrace a Odkazy</h3>
        <label>Discord Webhook URL</label>
        <input id="webhookLink">
        <label>Google Forms URL</label>
        <input id="googleFormsLink">
        
        <h3>Web Texty (CS verze)</h3>
        <label>Hero Nadpis</label>
        <input id="editHeroTitle">
        <label>Hero Popisek</label>
        <textarea id="editHeroText"></textarea>

        <button onclick="saveSettings()">Uložit změny</button>
        <button class="closeAdmin" onclick="closeAdmin()">Zavřít panel</button>
    </div>
</div>

<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
<script>
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "V9#Discord2026!";

let currentAuthAction = 'login';
let loggedInUser = null;

const translations = {
    cs: {
        heroT: "Vytvoř si profesionální Discord server",
        heroP: "Kompletní tvorba Discord serverů, botů a automatizace na míru.",
        faqTitle: "Často kladené otázky",
        stat1: "Serverů", stat2: "Vlastních botů", stat3: "Spokojenost",
        navLogin: "Přihlásit se", navRegister: "Registrace", navLogout: "Odhlásit", btnOrder: "Objednat",
        authLoginTitle: "Přihlášení", authRegisterTitle: "Registrace nového účtu", authSubmitL: "Přihlásit se", authSubmitR: "Zaregistrovat se", authCancel: "Zrušit",
        lblOrderName: "Jméno / Nick", lblOrderDiscord: "Discord Tag / ID", lblOrderEmail: "E-mail", lblOrderDetails: "Co chceš vytvořit (detaily)", lblOrderNote: "Poznámka", lblOrderSubmit: "Pokračovat", lblOrderCancel: "Zrušit",
        lblAdminTitle: "Administrátor", lblAdminBtn: "Přihlásit se", lblAdminClose: "Zavřít",
        toastFields: "⚠️ Vyplňte prosím všechna povinná pole.", toastAuthFields: "⚠️ Vyplňte uživatelské jméno a heslo.", toastUserExists: "❌ Tento uživatel již existuje.", toastRegSuccess: "✅ Registrace úspěšná! Nyní se můžete přihlásit.", toastLoginSuccess: "👋 Vítej zpět, ", toastWrongAuth: "❌ Nesprávné jméno nebo heslo.", toastLogout: "ℹ️ Byl jsi odhlášen.", toastLoginRequired: "🔒 Pro objednání balíčku se musíte nejdříve přihlásit!", toastOrderSuccess: "✅ Objednávka odeslána na Discord! Přesměrovávám...", toastWebhookErr: "❌ Chyba při odesílání na Webhook.", toastNoWebhook: "⚠️ Není nastaven Discord Webhook v admin panelu. Přesměrovávám...", toastWrongAdmin: "❌ Špatné přihlašovací údaje.",
        packages: {
            p1: ["Kompletní struktura kanálov", "Nastavení rolí a hierarchie", "Základní permise (práva)", "Integrace hudebních botů", "Základní uvítací zpráva"],
            p2: ["Vše z balíčku Start", "Propojený Ticket systém", "Pokročilý design (emoji & fonty)", "Ochrana proti raidům a spamu", "Auto-role po připojení", "Levelovací systém pro členy"],
            p3: ["Vše z balíčku Medium", "Vlastní Discord Bot na míru", "Propojení s externí API", "Verifikační systém (proti botům)", "Statistiky serveru do hlasových kanálů", "Stream & YouTube notifikace", "Podpora na 14 dní zdarma"],
            p4: ["Vše z balíčku Pro", "Pokročilý Ekonomický systém", "Propojení s webem / databází", "Custom branding & grafika serveru", "Kompletní nastavení Store / Plateb", "Doživotní technická podpora", "Hostování bota na 3 měsíce zdarma"]
        },
        faqs: [
            { q: "Jak dlouho trvá vytvoření?", a: "Většinou máme server hotový do 3 až 5 dnů v závislosti na komplexnosti zadání." },
            { q: "Jak probíhá platba?", a: "Podrobnosti o platbě s vámi vyřešíme po odeslání formuláře na základě vašich preferencí." }
        ]
    },
    en: {
        heroT: "Create a Professional Discord Server",
        heroP: "Complete creation of Discord servers, bots and custom automation.",
        faqTitle: "Frequently Asked Questions",
        stat1: "Servers", stat2: "Custom Bots", stat3: "Satisfaction",
        navLogin: "Log In", navRegister: "Register", navLogout: "Log Out", btnOrder: "Order Now",
        authLoginTitle: "Login", authRegisterTitle: "Register New Account", authSubmitL: "Log In", authSubmitR: "Register", authCancel: "Cancel",
        lblOrderName: "Name / Nickname", lblOrderDiscord: "Discord Tag / ID", lblOrderEmail: "E-mail", lblOrderDetails: "What do you want to create (details)", lblOrderNote: "Note", lblOrderSubmit: "Continue", lblOrderCancel: "Cancel",
        lblAdminTitle: "Administrator", lblAdminBtn: "Log In", lblAdminClose: "Close",
        toastFields: "⚠️ Please fill in all required fields.", toastAuthFields: "⚠️ Please enter your username and password.", toastUserExists: "❌ This user already exists.", toastRegSuccess: "✅ Registration successful! You can now log in.", toastLoginSuccess: "👋 Welcome back, ", toastWrongAuth: "❌ Incorrect username or password.", toastLogout: "ℹ️ You have been logged out.", toastLoginRequired: "🔒 You must log in first to order a package!", toastOrderSuccess: "✅ Order sent to Discord! Redirecting...", toastWebhookErr: "❌ Error sending to Webhook.", toastNoWebhook: "⚠️ Discord Webhook is not set in the admin panel. Redirecting...", toastWrongAdmin: "❌ Incorrect admin credentials.",
        packages: {
            p1: ["Complete channel structure", "Roles and hierarchy setup", "Basic permissions setup", "Music bots integration", "Basic welcome message"],
            p2: ["Everything from Start package", "Integrated Ticket system", "Advanced design (emojis & fonts)", "Anti-raid and anti-spam protection", "Auto-role on join", "Leveling system for members"],
            p3: ["Everything from Medium package", "Custom Discord Bot made to order", "Connection with external API", "Verification system (anti-bot)", "Server statistics in voice channels", "Stream & YouTube notifications", "Free support for 14 days"],
            p4: ["Everything from Pro package", "Advanced Economy system", "Website / database integration", "Custom branding & server graphics", "Full Store / Payment setup", "Lifetime technical support", "Free bot hosting for 3 months"]
        },
        faqs: [
            { q: "How long does it take?", a: "We usually have the server ready within 3 to 5 days, depending on the complexity of the project." },
            { q: "How does the payment work?", a: "We will handle the payment details with you after submitting the form based on your preferences." }
        ]
    }
};

function getActiveLang() {
    return document.getElementById("langSelect").value;
}

function changeLanguage(lang) {
    const trans = translations[lang] || translations.cs;
    
    document.getElementById("heroTitle").innerText = trans.heroT;
    document.getElementById("heroText").innerText = trans.heroP;
    document.getElementById("faqTitle").innerText = trans.faqTitle;
    
    document.getElementById("statLabel1").innerText = trans.stat1;
    document.getElementById("statLabel2").innerText = trans.stat2;
    document.getElementById("statLabel3").innerText = trans.stat3;
    
    document.getElementById("navLoginBtn").innerText = trans.navLogin;
    document.getElementById("navRegisterBtn").innerText = trans.navRegister;
    document.getElementById("navLogoutBtn").innerText = trans.navLogout;
    
    document.querySelectorAll(".btn-order").forEach(btn => btn.innerText = trans.btnOrder);
    
    renderPackages(lang);
    renderFaqs(lang);
}

function renderPackages(lang) {
    const trans = translations[lang] || translations.cs;
    for (let i = 1; i <= 4; i++) {
        const ul = document.getElementById("features" + i);
        if(!ul) continue;
        ul.innerHTML = "";
        const packFeatures = trans.packages["p" + i] || [];
        packFeatures.forEach(f => {
            const li = document.createElement("li");
            li.innerHTML = \`<i class="fas fa-check" style="color:var(--green)"></i> \${f}\`;
            ul.appendChild(li);
        });
    }
}

function renderFaqs(lang) {
    const trans = translations[lang] || translations.cs;
    const container = document.getElementById("faqContainer");
    if(!container) return;
    container.innerHTML = "";
    
    trans.faqs.forEach(faq => {
        const item = document.createElement("div");
        item.className = "faq-item";
        
        const q = document.createElement("div");
        q.className = "faq-question";
        q.innerHTML = \`\${faq.q} <i class="fas fa-chevron-down"></i>\`;
        
        const a = document.createElement("div");
        a.className = "faq-answer";
        a.innerText = faq.a;
        
        q.addEventListener("click", () => {
            const isOpen = a.style.maxHeight && a.style.maxHeight !== "0px";
            document.querySelectorAll(".faq-answer").forEach(ans => {
                ans.style.maxHeight = "0px";
                ans.style.padding = "0 20px";
            });
            if(!isOpen) {
                a.style.maxHeight = a.scrollHeight + 40 + "px";
                a.style.padding = "20px";
            }
        });
        
        item.appendChild(q);
        item.appendChild(a);
        container.appendChild(item);
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const target = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", target);
    const icon = document.querySelector(".theme-toggle i");
    if(target === "light") {
        icon.className = "fas fa-sun";
    } else {
        icon.className = "fas fa-moon";
    }
}

function showToast(keyOrText, isDirectText = false) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    
    if(isDirectText) {
        toast.innerText = keyOrText;
    } else {
        const trans = translations[getActiveLang()] || translations.cs;
        toast.innerText = trans[keyOrText] || keyOrText;
    }
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function openAuthModal(action) {
    currentAuthAction = action;
    document.getElementById("authModal").style.display = "flex";
    const trans = translations[getActiveLang()] || translations.cs;
    if(action === 'login') {
        document.getElementById("authModalTitle").innerText = trans.authLoginTitle;
        document.getElementById("authSubmitBtn").innerText = trans.authSubmitL;
    } else {
        document.getElementById("authModalTitle").innerText = "Registrace";
        document.getElementById("authSubmitBtn").innerText = trans.authSubmitR;
    }
}

function closeAuthModal() {
    document.getElementById("authModal").style.display = "none";
}

// --- AUTENTIZACE PŘES DATABÁZI NA SERVERU ---
async function handleAuthSubmit() {
    const u = document.getElementById("authUsername").value.trim();
    const p = document.getElementById("authPassword").value.trim();
    
    if(!u || !p) {
        showToast("toastAuthFields");
        return;
    }
    
    const endpoint = currentAuthAction === 'register' ? '/api/auth/register' : '/api/auth/login';
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await response.json();
        
        if (currentAuthAction === 'register') {
            if (data.error === 'exists') {
                showToast("toastUserExists");
            } else if (data.success) {
                showToast("toastRegSuccess");
                openAuthModal('login');
            }
        } else {
            if (data.success) {
                loggedInUser = u;
                sessionStorage.setItem("activeUser", u);
                checkUserSession();
                closeAuthModal();
                showToast(translations[getActiveLang()].toastLoginSuccess + u + "!", true);
            } else {
                showToast("toastWrongAuth");
            }
        }
    } catch (e) {
        showToast("Chyba spojení se serverem.", true);
    }
}

function checkUserSession() {
    const sessionUser = sessionStorage.getItem("activeUser");
    if(sessionUser) {
        loggedInUser = sessionUser;
        document.getElementById("authMenu").style.display = "none";
        document.getElementById("userMenu").style.display = "flex";
        document.getElementById("welcomeText").innerText = \`👤 \${loggedInUser}\`;
    } else {
        loggedInUser = null;
        document.getElementById("authMenu").style.display = "flex";
        document.getElementById("userMenu").style.display = "none";
    }
}

function logoutUser() {
    sessionStorage.removeItem("activeUser");
    checkUserSession();
    showToast("toastLogout");
}

function openOrderModal(packName) {
    if(!loggedInUser) {
        showToast("toastLoginRequired");
        return;
    }
    document.getElementById("selectedPackage").value = packName;
    document.getElementById("orderModal").style.display = "flex";
}
function closeOrderModal() { document.getElementById("orderModal").style.display = "none"; }

function openAdminLogin() { document.getElementById("loginBox").style.display = "flex"; }
function closeLogin() { document.getElementById("loginBox").style.display = "none"; }

function loginAdmin() {
    const u = document.getElementById("adminUser").value;
    const p = document.getElementById("adminPass").value;
    if(u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
        closeLogin();
        document.getElementById("adminPanel").style.display = "block";
        loadSettingsFromServer(); 
    } else {
        showToast("toastWrongAdmin");
    }
}
function closeAdmin() { document.getElementById("adminPanel").style.display = "none"; }

// --- UKLÁDÁNÍ ADMINISTRÁTORA DO DATABÁZE ---
async function saveSettings() {
    const settings = {
        name1: document.getElementById("editName1").value,
        price1: document.getElementById("editPrice1").value,
        name2: document.getElementById("editName2").value,
        price2: document.getElementById("editPrice2").value,
        name3: document.getElementById("editName3").value,
        price3: document.getElementById("editPrice3").value,
        name4: document.getElementById("editName4").value,
        price4: document.getElementById("editPrice4").value,
        stat1: document.getElementById("editStat1").value,
        statLabel1: document.getElementById("editStatLabel1").value,
        stat2: document.getElementById("editStat2").value,
        statLabel2: document.getElementById("editStatLabel2").value,
        webhook: document.getElementById("webhookLink").value,
        googleForms: document.getElementById("googleFormsLink").value,
        heroTitle: document.getElementById("editHeroTitle").value,
        heroText: document.getElementById("editHeroText").value,
    };

    try {
        const response = await fetch('/api/admin/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        const data = await response.json();
        if(data.success) {
            showToast("Změny uloženy do databáze!", true);
            applySettingsToUI(settings);
        }
    } catch(e) {
        showToast("Chyba při ukládání na server.", true);
    }
}

// Načtení dat z DB
async function loadSettingsFromServer() {
    try {
        const response = await fetch('/api/admin/load');
        const settings = await response.json();
        
        if (Object.keys(settings).length > 0) {
            document.getElementById("editName1").value = settings.name1 || "";
            document.getElementById("editPrice1").value = settings.price1 || "";
            document.getElementById("editName2").value = settings.name2 || "";
            document.getElementById("editPrice2").value = settings.price2 || "";
            document.getElementById("editName3").value = settings.name3 || "";
            document.getElementById("editPrice3").value = settings.price3 || "";
            document.getElementById("editName4").value = settings.name4 || "";
            document.getElementById("editPrice4").value = settings.price4 || "";
            document.getElementById("editStat1").value = settings.stat1 || "";
            document.getElementById("editStatLabel1").value = settings.statLabel1 || "";
            document.getElementById("editStat2").value = settings.stat2 || "";
            document.getElementById("editStatLabel2").value = settings.statLabel2 || "";
            document.getElementById("webhookLink").value = settings.webhook || "";
            document.getElementById("googleFormsLink").value = settings.googleForms || "";
            document.getElementById("editHeroTitle").value = settings.heroTitle || "";
            document.getElementById("editHeroText").value = settings.heroText || "";
            
            applySettingsToUI(settings);
        }
    } catch(e) {
        console.error("Nepodařilo se načíst data z DB", e);
    }
}

function applySettingsToUI(settings) {
    if(settings.name1) document.getElementById("name1").innerText = settings.name1;
    if(settings.price1) document.getElementById("price1").innerText = settings.price1;
    if(settings.name2) document.getElementById("name2").innerText = settings.name2;
    if(settings.price2) document.getElementById("price2").innerText = settings.price2;
    if(settings.name3) document.getElementById("name3").innerText = settings.name3;
    if(settings.price3) document.getElementById("price3").innerText = settings.price3;
    if(settings.name4) document.getElementById("name4").innerText = settings.name4;
    if(settings.price4) document.getElementById("price4").innerText = settings.price4;
    if(settings.stat1) document.getElementById("stat1").innerText = settings.stat1;
    if(settings.statLabel1) document.getElementById("statLabel1").innerText = settings.statLabel1;
    if(settings.stat2) document.getElementById("stat2").innerText = settings.stat2;
    if(settings.statLabel2) document.getElementById("statLabel2").innerText = settings.statLabel2;
    if(settings.heroTitle) document.getElementById("heroTitle").innerText = settings.heroTitle;
    if(settings.heroText) document.getElementById("heroText").innerText = settings.heroText;
}

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loader").style.opacity = "0";
    setTimeout(() => document.getElementById("loader").style.visibility = "hidden", 400);
    
    AOS.init({ duration: 800, once: true });
    changeLanguage("cs");
    checkUserSession();
    loadSettingsFromServer(); 
});

// Efekt částic na pozadí
const canvas = document.getElementById('particle-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 0.4 - 0.2;
            this.speedY = Math.random() * 0.4 - 0.2;
            this.alpha = Math.random() * 0.4 + 0.2;
        }
        update() {
            this.x += this.speedX; this.y += this.speedY;
            if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
            if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
        }
        draw() {
            ctx.fillStyle = \`rgba(88, 101, 242, \${this.alpha})\`;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        }
    }
    for(let i=0; i<60; i++) particles.push(new Particle());
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// Custom kurzor
const cursor = document.getElementById("cursor");
const cursorDot = document.getElementById("cursor-dot");
window.addEventListener("mousemove", (e) => {
    cursor.style.left = e.clientX + "px"; cursor.style.top = e.clientY + "px";
    cursorDot.style.left = e.clientX + "px"; cursorDot.style.top = e.clientY + "px";
});
</script>
</body>
</html>
    `);
});

// Nastartování serveru
app.listen(PORT, () => {
    console.log(`Skript úspěšně běží. Web najdeš na adrese: http://localhost:${PORT}`);
});
