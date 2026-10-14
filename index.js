cd ~/Bot-tools
cat > index.js << 'EOF'
require('./config.js')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

if (!fs.existsSync('./plugins')) fs.mkdirSync('./plugins')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (t) => new Promise((res) => rl.question(t, res))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: false
    })

    if (!sock.authState.creds.registered) {
        console.log('\n=== BOT-TOOLS GILBERT PAIRING MODE ===')
        let phoneNumber = await question('MASUKIN NOMOR BOT LU (628xxxxx): ')
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
        const code = await sock.requestPairingCode(phoneNumber)
        console.log(`\nKODE PAIRING LU: ${code}`)
        console.log('Buka WA > Perangkat Tertaut > Tautkan dgn nomor telepon > Masukin kode ini\n')
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log(`✅ BOT ${global.botName} AKTIF - MODE: ${global.mode}`)
            try { rl.close() } catch {}
        }
    })

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const sender = isGroup? msg.key.participant : from
        const senderNumber = sender.split('@')[0]
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || ""
        if (!body.startsWith(global.prefix) &&!body.startsWith('.')) return

        const prefix = body.startsWith('.')? '.' : global.prefix
        const args = body.slice(prefix.length).trim().split(/ +/)
        const command = args.shift().toLowerCase()
        const text = args.join(" ")
        const isOwner = global.owner.includes(senderNumber)

        if (command === 'owner') {
            const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Gilbert Owner\nORG:Bot-tools;\nTEL;type=CELL;type=VOICE;waid=6285820673526:+62 858-2067-3526\nEND:VCARD'
            await sock.sendMessage(from, { contacts: { displayName: 'Gilbert Owner', contacts: [{ vcard }] } })
            await sock.sendMessage(from, { text: `Owner gue nih 👆\nwa.me/6285820673526` })
        }

        if (command === 'menu') {
            const menuText = `╭─ *${global.botName}* ─\n│ Mode: ${global.mode.toUpperCase()}\n│ Owner: wa.me/6285820673526\n├─ OWNER MENU\n│.addplugin <nama> (reply kode)\n│.delplugin <nama>\n│!owner\n├─ TOOLS MENU\n│!brat <teks>\n│!sticker (reply foto)\n│!ping |!menu\n╰─ Created by Gilbert`
            await sock.sendMessage(from, { text: menuText })
        }

        if (command === 'ping') {
            await sock.sendMessage(from, { text: `Pong! 🏓 Bot Aktif mode ${global.mode}` })
        }

        if (command === 'addplugin') {
            if (!isOwner) return sock.sendMessage(from, { text: `Khusus owner bro!` })
            if (!text) return sock.sendMessage(from, { text: `Contoh:.addplugin brat` })
            const quoted = m.messages[0].message.extendedTextMessage?.contextInfo?.quotedMessage
            const code = quoted?.conversation || quoted?.extendedTextMessage?.text || body.split('\n').slice(1).join('\n')
            if (!code) return sock.sendMessage(from, { text: `Reply kode pluginnya` })
            const fileName = text.endsWith('.js')? text : text + '.js'
            fs.writeFileSync(`./plugins/${fileName}`, code)
            await sock.sendMessage(from, { text: `✅ Plugin ${fileName} ditambahkan!` })
        }

        if (command === 'delplugin') {
            if (!isOwner) return sock.sendMessage(from, { text: `Khusus owner bro!` })
            const fileName = text.endsWith('.js')? text : text + '.js'
            const fp = `./plugins/${fileName}`
            if (!fs.existsSync(fp)) return sock.sendMessage(from, { text: `Gak ada plugin ${fileName}` })
            fs.unlinkSync(fp)
            await sock.sendMessage(from, { text: `🗑️ Plugin ${fileName} dihapus!` })
        }

        if (command === 'brat') {
            if (!text) return sock.sendMessage(from, { text: `Contoh:!brat gilbert ganteng` })
            const url = `https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(text)}`
            await sock.sendMessage(from, { sticker: { url }, packname: global.botName })
        }
    })
}

startBot()
EOF
node index.js
