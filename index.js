const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const P = require("pino")
const http = require("http")

http.createServer((req,res)=> res.end("Bot Running")).listen(process.env.PORT || 3000, ()=> console.log("Server started"))

async function startBot(){
const { state, saveCreds } = await    useMultiFileAuthState("auth3")
const { version } = await fetchLatestBaileysVersion()
console.log("Using WA Version:", version)

const sock = makeWASocket({
version,
auth: {
creds: state.creds,
keys: makeCacheableSignalKeyStore(state.keys, P({level:"silent"}))
},
logger: P({level:"silent"}),
printQRInTerminal: false,
browser: ["Ubuntu","Chrome","20.0.04"],
syncFullHistory: false
})

sock.ev.on("creds.update", saveCreds)

if(!state.creds.registered){
console.log("Waiting 5 sec before requesting code...")
await new Promise(r=>setTimeout(r,5000))
try{
let code = await sock.requestPairingCode("2348121060140")
console.log("================================")
console.log("PAIRING CODE: "+code)
console.log("Go to WhatsApp > Linked Devices > Link with phone number")
console.log("You have 60 seconds!")
console.log("================================")
}catch(e){
console.log("Error getting code:", e.message)
}
}

sock.ev.on("connection.update", async (u)=>{
console.log("Connection:", u.connection)
if(u.connection === "open") console.log("✅ BOT CONNECTED!")
if(u.connection === "close"){
console.log("Closed, waiting 10 sec...")
await new Promise(r=>setTimeout(r,10000))
startBot()
}
})
}

startBot()
