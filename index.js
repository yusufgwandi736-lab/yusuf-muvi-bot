const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const P = require("pino")
const http = require("http")

// This keeps Render alive - VERY IMPORTANT
http.createServer((req,res)=> res.end("Yusuf Muvi Bot Running ✅")).listen(process.env.PORT || 3000, ()=> console.log("Server started on PORT"))

async function startBot(){
const { state, saveCreds } = await useMultiFileAuthState("auth")
const sock = makeWASocket({
auth: state,
logger: P({level:"silent"}),
printQRInTerminal: false,
browser: ["Ubuntu","Chrome","22.04.4"]
})

sock.ev.on("creds.update", saveCreds)

if(!sock.authState.creds.registered){
console.log("Waiting for WhatsApp connection...")
await new Promise(r=>setTimeout(r, 8000))
try{
let code = await sock.requestPairingCode("2348121060140")
console.log("================================")
console.log(`PAIRING CODE IS: ${code}`)
console.log("Enter in WhatsApp > Linked Devices > Link with phone number")
console.log("================================")
}catch(e){
console.log("Failed to get code, will try again:", e.message)
}
}

sock.ev.on("connection.update", async (u)=>{
if(u.connection === "open"){
console.log("BOT CONNECTED ✅✅✅")
}
if(u.connection === "close"){
console.log("Connection closed, reconnecting in 3 sec...")
setTimeout(startBot, 3000)
}
})
}

startBot()
