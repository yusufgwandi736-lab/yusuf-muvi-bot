const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const P = require("pino")
const http = require("http")

http.createServer((req,res)=> res.end("Bot Running ✅")).listen(process.env.PORT || 3000, ()=> console.log("Server started on PORT"))

async function startBot(){
const { state, saveCreds } = await useMultiFileAuthState("auth")
const sock = makeWASocket({
auth: state,
logger: P({level:"silent"}),
printQRInTerminal: false,
browser: ["Chrome","Chrome",""]
})

sock.ev.on("creds.update", saveCreds)

if(!sock.authState.creds.registered){
console.log("Waiting for WhatsApp connection...")
setTimeout(async()=>{
try{
let code = await sock.requestPairingCode("2348121060140")
console.log("================================")
console.log(`PAIRING CODE IS: ${code}`)
console.log("================================")
}catch(e){
console.log("Failed:", e.message, "- Restarting...")
setTimeout(startBot, 5000)
}
}, 3000)
}

sock.ev.on("connection.update", (u)=>{
if(u.connection === "open") console.log("BOT CONNECTED ✅")
if(u.connection === "close") console.log("Closed, will retry...")
})
}

startBot()
