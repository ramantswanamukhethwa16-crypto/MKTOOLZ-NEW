const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage, Browsers } = require('@whiskeysockets/baileys');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');

const API_ID = 37250890;
const API_HASH = 'dd2b4ccdec54ac3b4dd363ecac493304';
const TARGET_BOT = 'ScriptoolzDecrypt_bot';
const SESSION_FILE = path.join(__dirname, 'telegram_session.txt');
const DB_FILE = path.join(__dirname, 'bot_database.json');
const WHATSAPP_CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb9IKw17T8bZRw09iR2n';

// Your active HilltopAds DirectLink configuration
const HILLTOP_DIRECT_LINK = 'https://plump-plastic.com/gz19tk';
const HILLTOP_API_KEY = '1H1nfnApO9MEcy4Sxp3kEcPDw4NERRHxI8AsV5ZikCqYtLV8vWi3oFczftEudOGX';

// Termux storage path for logo image mapped via termux-setup-storage
const LOGO_PATH = path.join(process.env.HOME || '/data/data/com.termux/files/home', 'storage', 'dcim', 'Screenshots', 'logo.jpg');

// Dedicated phone number for remote pairing on bot hosting
const MY_PHONE_NUMBER = '27727098133';

// Database initialization with persistent pairedNumbers registry
let db = {
    users: {}, // { senderNumber: { name, number, queriesCount, lastActive, banned } }
    history: [], // [{ number, name, input, timestamp }]
    pairedNumbers: [MY_PHONE_NUMBER], // Persistent registry of authorized paired numbers (digits only)
    adminPassword: '0734548144',
    adEarnings: 0.00 // Fallback local tracker
};

if (fs.existsSync(DB_FILE)) {
    try {
        const loadedDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db = { ...db, ...loadedDb };
        if (!db.pairedNumbers.includes(MY_PHONE_NUMBER)) {
            db.pairedNumbers.push(MY_PHONE_NUMBER);
        }
    } catch (e) {}
}

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizeNumber(num) {
    if (!num) return '';
    return num.toString().replace(/[^0-9]/g, '');
}

// Function to fetch live balance from HilltopAds API
async function fetchLiveHilltopBalance() {
    try {
        const response = await fetch(`https://api.hilltopads.com/publisher/balance?key=${HILLTOP_API_KEY}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && (data.balance !== undefined || data.amount !== undefined)) {
            return parseFloat(data.balance || data.amount);
        }
    } catch (e) {
        console.log('⚠️ Failed to fetch live HilltopAds balance, using local tracker:', e.message);
    }
    return null;
}

const BOT_FOOTER = "\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙY *ᴿ.ᴹ_⃝⃘̉̉ᴷᴴƐᵀᴴᵂᴬ*";

function wrapMessage(body, sessionData) {
    const dynamicHeader = `╭┈───〔 MKTOOLZ-WD 〕┈───⊷
├✦ Creator: ᴿ.ᴹ_⃝⃘̉̉ᴷᴴƐᵀᴴᵂᴬ
├✦ Status: Online
├✦ Version: 1.0.0
├✦ Mode: Public
├✦ Prefix: /
╰───────────────────⊷`;

    return `${dynamicHeader}\n\n{body}{BOT_FOOTER}`.replace('{body}', body).replace('{BOT_FOOTER}', BOT_FOOTER);
}

function cleanText(text, senderName = 'User') {
    if (!text) return "";
    let cleaned = text
        .replace(/@ScriptoolzDecrypt_bot/gi, '')
        .replace(/Telegram/gi, '')
        .replace(/telegram/gi, '')
        .replace(/t\.me\/[^\s]+/gi, '')
        .replace(/sponsored/gi, '')
        .replace(/ads?:?/gi, '')
        .replace(/ad\s*[:\-].*?(?=\n|$)/gi, '')
        .replace(/share\s*manage.*?(?=\n|$)/gi, '')
        .replace(/join\s*our\s*channel.*?(?=\n|$)/gi, '')
        .replace(/Next\s*request:\s*Wait\s*\d+s/gi, '')
        .replace(/ENJOY/gi, '')
        .replace(/TG:\s*https?:\/\/[^\s]*/gi, '')
        .replace(/Create,\s*share\s*&\s*manage\s*VPN\s*configs\s*with\s*HTTP\s*Tweak\s*VPN:\s*https?:\/\/[^\s]*/gi, '')
        .replace(/Requested\s*by:\s*[^\n]+/gi, '')
        .replace(/You\s*are\s*free\s*to\s*use,\s*modify,\s*and\s*redistribute\s*this\s*work\s*for\s*any\s*purpose\..*?(?=\n|$)/gi, '')
        .replace(/Attribution\s*is\s*not\s*required[^\n]*/gi, '')
        .replace(/"dress"\s*:/gi, '"address":')
        .replace(/\bdress\b/gi, 'address')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    
    return `👤 *Requested By:* ${senderName}\n\n${cleaned}`;
}

async function sendMediaMessage(sock, remoteJid, captionText, sessionData) {
    const textToSend = wrapMessage(captionText, sessionData);
    if (fs.existsSync(LOGO_PATH)) {
        try {
            await sock.sendMessage(remoteJid, {
                image: fs.readFileSync(LOGO_PATH),
                caption: textToSend
            });
            return;
        } catch (err) {
            console.log('⚠️ Failed to send image from storage, falling back to text:', err.message);
        }
    }
    await sock.sendMessage(remoteJid, { text: textToSend });
}

const activeSessions = new Map();
const activeAdmins = new Set();

async function createOrLoadWhatsAppSession(sessionName, pairingNumber = null) {
    const sessionDir = path.join(__dirname, `auth_${sessionName}`);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        browser: Browsers.macOS("Safari")
    });

    const cleanPairingInput = normalizeNumber(pairingNumber);
    if (cleanPairingInput && !db.pairedNumbers.includes(cleanPairingInput)) {
        db.pairedNumbers.push(cleanPairingInput);
        saveDb();
    }

    const sessionData = {
        sock,
        prefix: '/',
        pairedNumber: cleanPairingInput || null,
        startupSent: false,
        pairingRequested: false
    };
    activeSessions.set(sessionName, sessionData);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                createOrLoadWhatsAppSession(sessionName, pairingNumber);
            }
        } else if (connection === 'open') {
            if (sock.user && sock.user.id) {
                const userNum = normalizeNumber(sock.user.id.split(':')[0]);
                sessionData.pairedNumber = userNum;
                if (!db.pairedNumbers.includes(userNum)) {
                    db.pairedNumbers.push(userNum);
                    saveDb();
                }
            }

            // Safe pairing code request on connection open if not already registered
            if (!sock.authState.creds.registered && pairingNumber && !sessionData.pairingRequested) {
                sessionData.pairingRequested = true;
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(pairingNumber);
                        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                        console.log(`\n🔑 Your 8-Digit WhatsApp Pairing Code for +${pairingNumber}:\n\n   ${formattedCode}\n\nCheck your hosting console logs to copy this code and link it in WhatsApp under Linked Devices > Link with phone number instead!\n`);
                    } catch (err) {
                        console.log('⚠️ Pairing code request notice:', err.message);
                    }
                }, 3000);
            }

            if (sessionData.pairedNumber && !sessionData.startupSent) {
                sessionData.startupSent = true;
                const targetJid = `${sessionData.pairedNumber}@s.whatsapp.net`;
                try {
                    const startupText = `🤖 *BOT CONNECTED SUCCESSFULLY!* 🤖\n\n✅ *THIS SESSION IS BOUND TO NUMBER:* +${sessionData.pairedNumber}\n🚀 *MKTOOLZ-WD IS ONLINE AND ACTIVE.* 🚀\n\n📢 *Join our WhatsApp Channel for updates:* ${WHATSAPP_CHANNEL_LINK}`;
                    await sendMediaMessage(sock, targetJid, startupText, sessionData);
                } catch (e) {}
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        // 🔒 SAFETY CHECK: Ignore messages sent by the bot itself to prevent loops
        if (msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const senderNumber = remoteJid ? remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : null;
        const senderName = msg.pushName || 'User';
        
        let actualMessage = msg.message;
        if (actualMessage.viewOnceMessageV2) actualMessage = actualMessage.viewOnceMessageV2.message;
        if (actualMessage.documentWithCaptionMessage) actualMessage = actualMessage.documentWithCaptionMessage.message;

        const messageType = Object.keys(actualMessage)[0];
        
        let text = '';
        if (messageType === 'conversation') {
            text = actualMessage.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = actualMessage.extendedTextMessage.text;
        } else if (messageType === 'documentMessage') {
            text = actualMessage.documentMessage.caption || '';
        } else if (messageType === 'fileMessage') {
            text = actualMessage.fileMessage.caption || '';
        }
        
        const currentPrefix = sessionData.prefix;
        const trimmedText = text ? text.trim() : '';

        if (sock.user && sock.user.id && !sessionData.pairedNumber) {
            const userNum = normalizeNumber(sock.user.id.split(':')[0]);
            sessionData.pairedNumber = userNum;
            if (!db.pairedNumbers.includes(userNum)) {
                db.pairedNumbers.push(userNum);
                saveDb();
            }
        }

        if (senderNumber) {
            const numericSender = normalizeNumber(senderNumber);
            if (db.users[numericSender] && db.users[numericSender].banned) {
                return;
            }
            if (!db.users[numericSender]) {
                db.users[numericSender] = { name: senderName, number: numericSender, queriesCount: 0, lastActive: Date.now(), banned: false };
                try {
                    const welcomeUserMsg = `👋 *Welcome to MKTOOLZ-WD!*\n\nStay updated with the latest config updates and tools by joining our official channel:\n${WHATSAPP_CHANNEL_LINK}`;
                    await sendMediaMessage(sock, remoteJid, welcomeUserMsg, sessionData);
                } catch (e) {}
            } else {
                db.users[numericSender].name = senderName;
                db.users[numericSender].lastActive = Date.now();
            }
            saveDb();
        }

        const isDocument = messageType === 'documentMessage' || messageType === 'fileMessage';

        if (isDocument) {
            const messageContent = actualMessage[messageType];
            const fileName = (messageContent.fileName || '').toLowerCase();
            const caption = messageContent.caption ? messageContent.caption.trim() : '';

            const isConfigFile = fileName.endsWith('.hat') || fileName.endsWith('.ehi') || fileName.endsWith('.hc') || fileName.endsWith('.tls') || fileName.endsWith('.sks');

            if (!isConfigFile && caption !== '/' && !caption.startsWith('/')) {
                return;
            }

            const numericSender = normalizeNumber(senderNumber);
            if (numericSender && db.users[numericSender] && db.users[numericSender].banned) return;

            if (numericSender) {
                db.users[numericSender].queriesCount = (db.users[numericSender].queriesCount || 0) + 1;
                db.history.push({ number: numericSender, name: senderName, timestamp: Date.now() });
                db.adEarnings = (db.adEarnings || 0) + 0.005;
                saveDb();
            }

            // Immediately react with loading symbol
            await sock.sendMessage(remoteJid, { react: { text: '🔄', key: msg.key } });
            
            let tempFilePath = null;
            let statusMsg = null;

            try {
                const stream = await downloadContentFromMessage(messageContent, messageType === 'documentMessage' ? 'document' : 'file');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                
                const savedFileName = messageContent.fileName || 'config_file.hat';
                tempFilePath = path.join(__dirname, savedFileName);
                fs.writeFileSync(tempFilePath, buffer);

                const initialTgMessages = await global.tgClient.getMessages(TARGET_BOT, { limit: 10 });
                const existingIds = new Set(initialTgMessages.map(m => m.id));

                await global.tgClient.sendFile(TARGET_BOT, {
                    file: tempFilePath,
                    caption: "Decrypt this config"
                });

                statusMsg = await sock.sendMessage(remoteJid, { text: wrapMessage("⏳ *Processing configuration file...*", sessionData) });

                let finalMsg = null;
                const startTime = Date.now();
                const timeoutMs = 70000; 

                while (Date.now() - startTime < timeoutMs) {
                    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                    const fetched = await global.tgClient.getMessages(TARGET_BOT, { limit: 10 });
                    
                    if (fetched && fetched.length > 0) {
                        for (const currentMsg of fetched) {
                            if (!existingIds.has(currentMsg.id) && !currentMsg.out) {
                                if (currentMsg.media || (currentMsg.message && currentMsg.message.trim().length > 0)) {
                                    finalMsg = currentMsg;
                                    break;
                                }
                            }
                        }
                        if (finalMsg) break;
                    }

                    try {
                        await sock.sendMessage(remoteJid, { 
                            edit: statusMsg.key, 
                            text: wrapMessage(`⏳ *Processing configuration...*\n⏱️ *Elapsed time:* ${elapsedSeconds} seconds`, sessionData) 
                        });
                    } catch (e) {}

                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                if (!finalMsg) {
                    const fallbackFetched = await global.tgClient.getMessages(TARGET_BOT, { limit: 5 });
                    if (fallbackFetched && fallbackFetched.length > 0) {
                        for (const m of fallbackFetched) {
                            if (!m.out && (m.media || (m.message && m.message.trim().length > 0))) {
                                finalMsg = m;
                                break;
                            }
                        }
                    }
                }

                if (!finalMsg) {
                    await sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } });
                    await sock.sendMessage(remoteJid, { text: wrapMessage(`❌ @${senderName} decryption timed out. Please try again.`, sessionData) });
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    try { await sock.sendMessage(remoteJid, { delete: statusMsg.key }); } catch (e) {}
                    return;
                }

                await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                
                let decryptedContentText = '';
                if (finalMsg.media) {
                    const downloadedBuffer = await global.tgClient.downloadMedia(finalMsg);
                    const outputFilePath = path.join(__dirname, `decrypted_${Date.now()}.txt`);
                    fs.writeFileSync(outputFilePath, downloadedBuffer);

                    let fileText = fs.readFileSync(outputFilePath, 'utf8');
                    fs.unlinkSync(outputFilePath);
                    const cleaned = cleanText(fileText, senderName);
                    decryptedContentText = `🔓 *Decrypted Configuration Data:*\n\n\`\`\`\n${cleaned}\n\`\`\``;
                } else if (finalMsg.message) {
                    const rawText = typeof finalMsg.message === 'string' ? finalMsg.message : (finalMsg.message.message || JSON.stringify(finalMsg.message));
                    const cleaned = cleanText(rawText, senderName);
                    decryptedContentText = `🔓 *Decrypted Data:*\n\n\`\`\`\n${cleaned}\n\`\`\``;
                }

                const sponsorBlock = `\n\n📢 *Sponsored Partner Offer:*\nTap below to support:\n${HILLTOP_DIRECT_LINK}`;
                
                await sock.sendMessage(remoteJid, { text: wrapMessage(decryptedContentText + sponsorBlock, sessionData) });

                if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                if (statusMsg) {
                    try { await sock.sendMessage(remoteJid, { delete: statusMsg.key }); } catch (e) {}
                }

            } catch (error) {
                if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                if (statusMsg) {
                    try { await sock.sendMessage(remoteJid, { delete: statusMsg.key }); } catch (e) {}
                }
                await sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } });
                await sock.sendMessage(remoteJid, { text: wrapMessage(`❌ *Error:* Decryption process failed: ${error.message}`, sessionData) });
            }
        }
        else if (trimmedText.startsWith(currentPrefix)) {
            const args = trimmedText.slice(currentPrefix.length).trim().split(' ');
            const command = args[0].toLowerCase();

            const publicCommands = ['start', 'info', 'formats', 'pair'];
            const adminMenuCommands = ['users', 'history', 'ban', 'unpair', 'exitdash'];

            if (!publicCommands.includes(command) && command !== 'admindash' && !adminMenuCommands.includes(command)) {
                return;
            }

            if (command === 'pair') {
                const targetNum = args[1] || MY_PHONE_NUMBER;
                const cleanedTarget = normalizeNumber(targetNum);
                if (!db.pairedNumbers.includes(cleanedTarget)) {
                    db.pairedNumbers.push(cleanedTarget);
                    saveDb();
                }

                await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                const newSessionName = `session_${Date.now()}`;
                createOrLoadWhatsAppSession(newSessionName, cleanedTarget);
                
                setTimeout(async () => {
                    const targetSession = activeSessions.get(newSessionName);
                    if (targetSession && targetSession.sock) {
                        try {
                            const code = await targetSession.sock.requestPairingCode(cleanedTarget);
                            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                            
                            await sock.sendMessage(remoteJid, { text: formattedCode });
                            
                            const instructions = `🔑 *Pairing Successful for +${cleanedTarget}*\n\n*How to connect:*\n1. Open WhatsApp on the target device\n2. Go to Settings > Linked Devices\n3. Tap 'Link a Device' > 'Link with phone number instead'\n4. Enter the 8-digit code above.\n\n📢 *Channel Updates:* ${WHATSAPP_CHANNEL_LINK}`;
                            await sendMediaMessage(sock, remoteJid, instructions, sessionData);
                        } catch (err) {}
                    }
                }, 6000);
                return;
            }

            if (command === 'admindash') {
                const passwordInput = args.slice(1).join(' ');
                if (passwordInput === db.adminPassword) {
                    activeAdmins.add(normalizeNumber(senderNumber));
                    await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                    
                    let liveBalance = await fetchLiveHilltopBalance();
                    if (liveBalance !== null) {
                        db.adEarnings = liveBalance;
                        saveDb();
                    }
                    
                    const totalUsers = Object.keys(db.users).length;
                    const totalQueries = db.history.length;
                    const earnings = (db.adEarnings || 0).toFixed(2);
                    
                    const dashBody = `👑 *ADMIN DASHBOARD (ACTIVE)* 👑

┏━━━━━━━━━━━━━━┓
┃  💰 *HILLTOPADS LIVE DASHBOARD*      
┃  💵 Real Revenue: \`$${earnings}\` USD      
┗━━━━━━━━━━━━━━┓

📊 *System Metrics:*
• Total Registered Users: ${totalUsers}
• Total Queries Decrypted: ${totalQueries}
• Paired Numbers Registered: ${db.pairedNumbers.length}
• Channel Link: ${WHATSAPP_CHANNEL_LINK}

🛠️ *Unlocked Admin Menu Commands:*
• \`${currentPrefix}users\` - View complete user directory
• \`${currentPrefix}history\` - View complete search history logs
• \`${currentPrefix}ban <number>\` - Ban a user
• \`${currentPrefix}unpair <number>\` - Remove user ban
• \`${currentPrefix}exitdash\` - Close admin session menu`;

                    await sock.sendMessage(remoteJid, { text: wrapMessage(dashBody, sessionData) });
                } else {
                    await sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } });
                    await sock.sendMessage(remoteJid, { text: wrapMessage("❌ *Access Denied:* Incorrect password.", sessionData) });
                }
                return;
            }

            if (adminMenuCommands.includes(command)) {
                if (!activeAdmins.has(normalizeNumber(senderNumber))) {
                    await sock.sendMessage(remoteJid, { react: { text: '❌', key: msg.key } });
                    await sock.sendMessage(remoteJid, { text: wrapMessage(`❌ *Access Denied:* You have to be in admindash to use this command. Unlock it first using \`${currentPrefix}admindash <password>\``, sessionData) });
                    return;
                }

                if (command === 'exitdash') {
                    activeAdmins.delete(normalizeNumber(senderNumber));
                    await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                    await sock.sendMessage(remoteJid, { text: wrapMessage("🔒 *Success:* Exited admin dashboard session. Admin menu commands are now locked.", sessionData) });
                    return;
                }
                else if (command === 'users') {
                    await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                    let userListText = '';
                    for (const [num, u] of Object.entries(db.users)) {
                        const isPairedTag = db.pairedNumbers.includes(num) ? ' [PAIRED/OWNER]' : '';
                        userListText += `• *${u.name}* (+${num})${isPairedTag} — Queries: ${u.queriesCount} ${u.banned ? '[BANNED]' : ''}\n`;
                    }

                    const usersBody = `👥 *COMPLETE REGISTERED USERS DIRECTORY*\n\n${userListText || 'No users recorded yet.'}`;
                    await sock.sendMessage(remoteJid, { text: wrapMessage(usersBody, sessionData) });
                }
                else if (command === 'history') {
                    await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                    const allHistory = [...db.history].reverse();
                    let historyText = allHistory.map(h => `• [${new Date(h.timestamp).toLocaleString()}] *${h.name}* (+${h.number}): Decrypted config`).join('\n');

                    const historyBody = `📜 *COMPLETE USER SEARCH HISTORY*\n\n${historyText || 'No history records found.'}`;
                    await sock.sendMessage(remoteJid, { text: wrapMessage(historyBody, sessionData) });
                }
                else if (command === 'ban') {
                    const targetBanNum = normalizeNumber(args[1]);
                    if (!targetBanNum) {
                        await sock.sendMessage(remoteJid, { text: wrapMessage("❌ Usage: `/ban <number>`", sessionData) });
                        return;
                    }
                    if (db.users[targetBanNum]) {
                        db.users[targetBanNum].banned = true;
                        saveDb();
                        await sock.sendMessage(remoteJid, { text: wrapMessage(`✅ User +${targetBanNum} has been banned from using the bot.`, sessionData) });
                    } else {
                        await sock.sendMessage(remoteJid, { text: wrapMessage(`❌ User +${targetBanNum} not found in database.`, sessionData) });
                    }
                }
                else if (command === 'unpair') {
                    const targetUnpairNum = normalizeNumber(args[1]);
                    if (!targetUnpairNum) {
                        await sock.sendMessage(remoteJid, { text: wrapMessage("❌ Usage: `/unpair <number>`", sessionData) });
                        return;
                    }
                    if (db.users[targetUnpairNum]) {
                        db.users[targetUnpairNum].banned = false;
                        saveDb();
                        await sock.sendMessage(remoteJid, { text: wrapMessage(`✅ User +${targetUnpairNum} unbanned / status reset.`, sessionData) });
                    } else {
                        await sock.sendMessage(remoteJid, { text: wrapMessage(`❌ User not found.`, sessionData) });
                    }
                }
                return;
            }

            if (command === 'start') {
                await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                const body = `Welcome to MKTOOLZ-WD

Send me a supported config file with \`/\` as the caption to decrypt it.

*Available Commands:*
• \`${currentPrefix}start\` - Display start message & command list
• \`${currentPrefix}info\` - View bot details & menu
• \`${currentPrefix}formats\` - View supported config formats
• \`${currentPrefix}pair <number>\` - Generate pairing code

📢 *Official Channel:* ${WHATSAPP_CHANNEL_LINK}`;
                await sendMediaMessage(sock, remoteJid, body, sessionData);
            } 
            else if (command === 'info') {
                await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                const body = `📋 *BOT INFORMATION* 📋

• *Bot Name:* MKTOOLZ-WD
• *Owner:* Ramantswana Mukhethwa
• *Bot Version:* 1.0.0
• *Creation Date:* July 2026
• *Channel:* ${WHATSAPP_CHANNEL_LINK}

 『 ᴍᴇɴᴜ  』
╭───────────────────⊷
┋ ⡡ ${currentPrefix}formats 
┋ ⡡ ${currentPrefix}start
┋ ⡡ ${currentPrefix}info 
┋ ⡡ ${currentPrefix}pair
╰───────────────────⊷`;
                await sendMediaMessage(sock, remoteJid, body, sessionData);
            } 
            else if (command === 'formats') {
                await sock.sendMessage(remoteJid, { react: { text: '✅', key: msg.key } });
                const body = `*Supported Config Formats:*

• HTTP Injector (\`.ehi\`, \`.ehil\`)
• HTTP Custom (\`.hc\`)
• HA Tunnel (\`.hat\`)
• TLS Tunnel (\`.tls\`)
• SocksIP, NetMod, DarkTunnel, and more.`;
                await sock.sendMessage(remoteJid, { text: wrapMessage(body, sessionData) });
            }
        }
    });
}

async function startRemoteBot() {
    let savedSession = '';
    if (fs.existsSync(SESSION_FILE)) {
        savedSession = fs.readFileSync(SESSION_FILE, 'utf8').trim();
    }

    const stringSession = new StringSession(savedSession);
    global.tgClient = new TelegramClient(stringSession, API_ID, API_HASH, { connectionRetries: 5 });
    
    try {
        await global.tgClient.start({
            phoneNumber: async () => '',
            password: async () => '',
            phoneCode: async () => '',
            onError: (err) => {},
        });
    } catch (e) {
        console.log('⚠️ Telegram client notice:', e.message);
    }

    await createOrLoadWhatsAppSession('primary_session', MY_PHONE_NUMBER);
}

startRemoteBot();

