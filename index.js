import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"
import { Groq } from "groq-sdk"
import fs from "fs"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

let memory = {}
if (fs.existsSync("memory.json")) {
  try { memory = JSON.parse(fs.readFileSync("memory.json", "utf-8")) } catch {}
}
function saveMemory() {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2))
}
function getUserMemory(jid) {
  if (!memory[jid]) memory[jid] = { favorites: {}, likes: [], facts: [], history: [] }
  if (!memory[jid].history) memory[jid].history = []
  return memory[jid]
}

async function extractAndSaveMemory(jid, text) {
  try {
    const extract = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `Extract personal info. Return ONLY JSON like {"name": "...", "favorites": {"food": "..."}, "likes": ["..."], "facts": ["..."] } If nothing, return {}.` },
        { role: "user", content: text }
      ]
    })
    const data = JSON.parse(extract.choices[0].message.content.replace(/```json|```/g, "").trim())
    const userMem = getUserMemory(jid)
    if (data.name) userMem.name = data.name
    if (data.favorites) Object.assign(userMem.favorites, data.favorites)
    if (data.likes) userMem.likes = [...new Set([...userMem.likes,...(data.likes||[])])]
    if (data.facts) userMem.facts = [...new Set([...userMem.facts,...(data.facts||[])])]
    saveMemory()
  } catch {}
}

async function getHumanReply(jid, text) {
  const userMem = getUserMemory(jid)
  userMem.history.push({ role: "user", content: text })
  if (userMem.history.length > 10) userMem.history = userMem.history.slice(-10)

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `You are YUSUF MUVI. LONG-TERM MEMORY: ${JSON.stringify({ favorites: userMem.favorites, likes: userMem.likes, facts: userMem.facts, name: userMem.name })}. You CAN use emojis sometimes, not every time. NEVER say you are AI. If asked "who are you" reply exactly: "I am YUSUF MUVI." If asked "who built you" reply: "I am built by Yusuf Muvi. He is a skilled developer who designed and built me to chat, learn, and assist like a real human." Be short, casual, friendly.`
      },
     ...userMem.history.slice(-8)
    ]
  })
  const reply = completion.choices[0].message.content
  userMem.history.push({ role: "assistant", content: reply })
  if (userMem.history.length > 10) userMem.history = userMem.history.slice(-10)
  saveMemory()
  return reply
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({ auth: state })
  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", (u) => {
    if (u.connection === "close") startBot()
    if (u.connection === "open") console.log("Bot LIVE - Private + Memory")
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

    await sock.sendPresenceUpdate("composing", from)
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))

    if (lower.includes("who are you")) {
      await sock.sendMessage(from, { text: "I am YUSUF MUVI." })
      return
    }
    if (lower.includes("who built you") || lower.includes("who build you") || lower.includes("who created you") || lower.includes("who made you")) {
      await sock.sendMessage(from, { text: "I am built by Yusuf Muvi. He is a skilled developer who designed and built me to chat, learn, and assist like a real human." })
      return
    }
    extractAndSaveMemory(from, text)
    const reply = await getHumanReply(from, text)
    await sock.sendMessage(from, { text: reply })
    await sock.sendPresenceUpdate("paused", from)
  })
}
startBot()
