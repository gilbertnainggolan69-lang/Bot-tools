cd ~
rm -rf Bot-tools
mkdir Bot-tools
cd Bot-tools
npm init -y
npm i @whiskeysockets/baileys pino

cat > config.js << 'EOF'
global.owner = ['6285820673526']
global.namabot = 'Gilbert-Tools'
EOF

cat > index.js << 'EOF'
require('./config.js')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    })

    if (!sock.authState.creds.registered) {
        const phoneNumber = '6285820673526'
        console.log('Nomor target: ' + phoneNumber)
        await new Promise(r => setTimeout(r, 3000))
        let code = await sock.requestPairingCode(phoneNumber)
        code = code?.match(/.{1,4}/g)?.join("-") || code
        console.log('\n=================================')
        console.log('KODE PAIRING LU: ' + code)
        console.log('=================================\n')
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'open') {
            console.log('✅ BOT AKTIF BOS! Gilbert-Tools UDAH KONEK!')
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        if (body.toLowerCase() === '!menu' || body.toLowerCase() === '.menu') {
            await sock.sendMessage(from, { text: '*Gilbert-Tools Aktif*\n\n!menu\n!ping\nOwner: 6285820673526' })
        }
        if (body.toLowerCase() === '!ping') {
            await sock.sendMessage(from, { text: 'PONG! Bot aktif bro ✅' })
        }
    })
}
startBot()
EOF

node index.js
