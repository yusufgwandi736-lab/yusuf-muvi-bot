import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import { Groq } from "groq-sdk"
import qrcode from "qrcode-terminal"
import fs from "fs"
import pino from "pino"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

let memory = {}
if (fs.existsSync("memory.json")) {
  try { memory = JSON.parse(fs.readFileSync("memory.json", "utf-8")) } catch {}
}
function saveMemory() { fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2)) }
function getUserMemory(jid) {
  if (!memory[jid]) memory[jid] = { favorites: {}, likes: [], facts: [], history: [] }
  if (!memory[jid].history) memory[jid].history = []
  return memory[jid]
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      console.log("SCAN THIS QR TO LINK WHATSAPP:")
      qrcode.generate(qr, { small: true })
    }
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    }
    if (connection === "open") {
      console.log("Bot LIVE - Private + Memory + Connected to WA ✅")
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    if (from.endsWith("@g.us")) return
    if (from === "status@broadcast") return
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text
    if (!text) return

    const lower = text.toLowerCase()
    if (lower.includes("who are you")) {
      await sock.sendMessage(from, { text: "I am YUSUF MUVI." })
      return
    }
    if (lower.includes("who built you") || lower.includes("who made you") || lower.includes("who created you")) {
      await sock.sendMessage(from, { text: "I am built by Yusuf Muvi. He is a skilled developer who designed and built me to chat, learn, and assist like a real human." })
      return
    }

    const userMem = getUserMemory(from)
    userMem.history.push({ role: "user", content: text })
    if (userMem.history.length > 10) userMem.history = userMem.history.slice(-10)

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: `You are YUSUF MUVI. MEMORY: ${JSON.stringify({ name: userMem.name, favorites: userMem.favorites, likes: userMem.likes, facts: userMem.facts })}. Never say you are AI. Be short, casual.` },
         ...userMem.history.slice(-8)
        ]
      })
      const reply = completion.choices[0].message.content
      userMem.history.push({ role: "assistant", content: reply })
      saveMemory()
      await sock.sendPresenceUpdate("composing", from)
      await new Promise(r => setTimeout(r, 1000))
      await sock.sendMessage(from, { text: reply })
    } catch (e) {
      console.log("Groq error", e.message)
    }
  })
}
startBot()
