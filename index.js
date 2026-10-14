require('./config.js')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const path = require('path')

// BIKIN FOLDER PLUGIN
if (!fs.existsSync('./plugins')) fs.mkdirSync('./plugins')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        markOnlineOnConnect: global.mode!== 'gilbert'
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log(`BOT ${global.botName} AKTIF - MODE: ${global.mode}`)
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
        const isOwner = global.owner.includes(senderNumber) || global.owner.includes('62' + senderNumber.slice(1))

        console.log(`[${command}] dari ${senderNumber}`)

        // ===== MENU OWNER =====
        if (command === 'owner') {
            const vcard = 'BEGIN:VCARD\n' +
                          'VERSION:3.0\n' +
                          'FN:Gilbert Owner\n' +
                          'ORG:Bot-tools;\n' +
                          'TEL;type=CELL;type=VOICE;waid=6285820673526:+62 858-2067-3526\n' +
                          'END:VCARD'
            await sock.sendMessage(from, { contacts: { displayName: 'Gilbert Owner', contacts: [{ vcard }] } })
            await sock.sendMessage(from, { text: `Itu owner gue bang, chat aja 👆\nwa.me/6285820673526` })
        }

        if (command === 'menu') {
            const menuText = `╭─ *${global.botName}* ─
│ Mode: ${global.mode.toUpperCase()}
│ Prefix: ${global.prefix} /.
├─ OWNER MENU
│.addplugin <nama> (reply kode)
│.delplugin <nama>
│!owner
├─ TOOLS MENU
│!brat <teks>
│!sticker (reply foto)
│!ping
╰─ Created by Gilbert`
            await sock.sendMessage(from, { text: menuText })
        }

        if (command === 'ping') {
            await sock.sendMessage(from, { text: `Pong! 🏓 Bot Aktif` })
        }

        // ===== ADD PLUGIN =====
        if (command === 'addplugin') {
            if (!isOwner) return sock.sendMessage(from, { text: `Khusus owner bro!` })
            if (!text) return sock.sendMessage(from, { text: `Contoh:.addplugin brat` })
            const code = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || body.split('\n').slice(1).join('\n')
            if (!code) return sock.sendMessage(from, { text: `Reply kode yang mau dijadiin plugin atau ketik di bawah nama file:\n.addplugin tes\nconsole.log("halo")` })
            const fileName = text.endsWith('.js')? text : text + '.js'
            fs.writeFileSync(`./plugins/${fileName}`, code)
            await sock.sendMessage(from, { text: `✅ Plugin ${fileName} berhasil ditambahkan!` })
        }

        // ===== DEL PLUGIN =====
        if (command === 'delplugin') {
            if (!isOwner) return sock.sendMessage(from, { text: `Khusus owner bro!` })
            if (!text) return sock.sendMessage(from, { text: `Contoh:.delplugin brat` })
            const fileName = text.endsWith('.js')? text : text + '.js'
            const filePath = `./plugins/${fileName}`
            if (!fs.existsSync(filePath)) return sock.sendMessage(from, { text: `Plugin ${fileName} gak ada!` })
            fs.unlinkSync(filePath)
            await sock.sendMessage(from, { text: `🗑️ Plugin ${fileName} berhasil dihapus!` })
        }

        // ===== BRAT =====
        if (command === 'brat') {
            if (!text) return sock.sendMessage(from, { text: `Contoh:!brat halo gilbert` })
            // pake API brat gratis, biar gak ribet canvas
            const bratUrl = `https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(text)}`
            await sock.sendMessage(from, { sticker: { url: bratUrl }, packname: global.botName })
        }

        // LOAD PLUGIN LUAR
        fs.readdirSync('./plugins').forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    const plugin = require(path.join(__dirname, 'plugins', file))
                    if (typeof plugin === 'function') plugin(sock, { from, command, args, text, sender, isOwner })
                } catch (e) {}
            }
        })
    })
}

startBot()

Tempel ini?
