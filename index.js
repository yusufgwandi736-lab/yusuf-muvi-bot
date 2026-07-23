
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const P = require("pino")

async function startBot(){
const { state, saveCreds } = await useMultiFileAuthState("auth")
const sock = makeWASocket({
auth: state,
logger: P({level:"silent"}),
printQRInTerminal: false,
browser: ["Ubuntu","Chrome","22.04"]
})

sock.ev.on("creds.update", saveCreds)

if(!sock.authState.creds.registered){
const phoneNumber = "2348121060140"
console.log("Requesting pairing code...")
setTimeout(async()=>{
try{
let code = await sock.requestPairingCode(phoneNumber)
console.log("============================")
console.log(`PAIRING CODE IS: ${code}`)
console.log("Enter this in WhatsApp > Linked Devices > Link with phone number")
console.log("============================")
}catch(e){
console.log("Failed:", e.message)
}
},5000)
}

sock.ev.on("connection.update", (u)=>{
if(u.connection === "open") console.log("BOT CONNECTED ✅")
})

}

startBot()
