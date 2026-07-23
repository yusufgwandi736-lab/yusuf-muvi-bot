const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const fs = require('fs')
const axios = require('axios')
const qrcode = require('qrcode-terminal')
const googleTTS = require('google-tts-api')
const http = require('http')

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_KEY_HERE"
const BOT_NAME = "Yusuf Muvi"

let memory = fs.existsSync('./memory.json')? JSON.parse(fs.readFileSync('./memory.json')) : { users: {} }
const saveMemory = () => fs.writeFileSync('./memory.json', JSON.stringify(memory, null, 2))

let messageCache = new Map()
let spamMap = new Map()

function getRequestedLanguage(t){ const l=t.toLowerCase(); if(l.includes('speak hausa')||l.includes('in hausa')||l.includes('yi hausa')||l.includes('magana da hausa')) return 'hausa'; if(l.includes('speak pidgin')||l.includes('in pidgin')||l.includes('talk pidgin')) return 'pidgin'; if(l.includes('speak english')||l.includes('in english')) return 'english'; return 'english' }
function getMode(t){ const l=t.toLowerCase(); if(l.includes('lol')||l.includes('haha')||l.includes('joke')||l.includes('😂')) return 'funny'; if(l.includes('sad')||l.includes('😢')) return 'sad'; if(l.includes('work')||l.includes('school')) return 'professional'; if(l.includes('won')||l.includes('🎉')) return 'hype'; return 'friendly' }
function isProofRequest(t){ return ['prove its you','prove it\'s you','are you really yusuf','is this really you','prove you are yusuf','prove am yusuf','tabbatarda kai ne'].some(k=>t.toLowerCase().includes(k)) }

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ["Ubuntu", "Chrome", "22.04.4"]
  })

  sock.ev.on('creds.update', saveCreds)

  // --- PAIRING CODE FIX FOR 2348121060140 ---
  if(!state.creds.registered){
    const phoneNumber = process.env.PHONE_NUMBER || "2348121060140"
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''))
        console.log(`\n============================\nPAIRING CODE FOR ${phoneNumber} IS: ${code}\n============================\nEnter this code in WhatsApp > Linked Devices > Link with phone number\n`)
      } catch(e) {
        console.log("Failed to get pairing code:", e.message)
      }
    }, 3000)
  }

  sock.ev.on('connection.update', (u)=>{
    const { connection, lastDisconnect, qr } = u
    if(qr) { console.log("SCAN THIS QR:"); qrcode.generate(qr, {small:true}) }
    if(connection==='close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
      console.log("Connection closed, reconnecting:", shouldReconnect)
      if(shouldReconnect) startBot()
    }
    if(connection==='open') console.log(BOT_NAME+" is Live 🚀")
  })

  sock.ev.on('call', async (calls) => {
    for(let call of calls){ if(call.status==='offer'){ await sock.rejectCall(call.id, call.from); await sock.sendMessage(call.from, {text:'Sorry, I no fit pick call now 🚀 Abeg drop message, Am Yusuf Muvi!'}) } }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]; if(!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || ""
    const lower = text.toLowerCase()
    messageCache.set(msg.key.id, { text, from })

    const now=Date.now(); let arr=spamMap.get(from)||[]; arr=arr.filter(t=>now-t<60000); arr.push(now); spamMap.set(from, arr)
    if(arr.length>10){ await sock.sendMessage(from, {text:'Abeg calm down 😅 Wait 1 min 🙏'}); return }

    if(msg.message.viewOnceMessage || msg.message.viewOnceMessageV2){
      try{
        const viewMsg = msg.message.viewOnceMessage?.message || msg.message.viewOnceMessageV2?.message
        const buffer = await downloadMediaMessage({key: msg.key, message: viewMsg}, 'buffer', {}, {})
        const type = Object.keys(viewMsg)[0]
        if(type==='imageMessage') await sock.sendMessage(from, {image: buffer, caption:'Saved View-Once 🔓'})
        if(type==='videoMessage') await sock.sendMessage(from, {video: buffer, caption:'Saved View-Once 🔓'})
      }catch(e){}
    }

    if(!memory.users[from]){ memory.users[from]={history:[], lastPicSent:0}; saveMemory()
      await sock.sendMessage(from, {text:`Welcome! 👋\nAm ${BOT_NAME} 🚀\nI was built by Yusuf Muvi.\nType *menu* to see what I can do!`}); return
    }
    const user = memory.users[from]

    if(lower.includes('love')||lower.includes('❤️')) await sock.sendMessage(from, {react:{text:'❤️', key:msg.key}})
    if(lower.includes('lol')||lower.includes('😂')) await sock.sendMessage(from, {react:{text:'😂', key:msg.key}})

    if(lower==='menu'||lower==='help'){
      await sock.sendMessage(from, {text:`*${BOT_NAME} MENU* 🚀\n\n💬 Just chat normally\n🌍 Say "speak hausa" / "speak pidgin" / "speak english"\n🎙️ Say "send voice note"\n🖼️ Say "prove it's you" for pic proof\n🎨 Send pic with caption "sticker"\n⏰ "remind me in 10 minutes to..."\n🕐 "what time is it"\n🌦️ "weather in Abuja"\n\nBuilt by Yusuf Muvi 💼`}); return
    }

    if(isProofRequest(text)){
      if(Date.now()-user.lastPicSent < 7200000){ await sock.sendMessage(from, {text:'I already sent proof pic, wait small 😊'}); return }
      const picPath='./my_pics/yusuf.jpg'; if(fs.existsSync(picPath)){
        const lang=getRequestedLanguage(text); let cap=lang==='hausa'?'Ni ne Yusuf Muvi 🚀':lang==='pidgin'?'Na me be this 🚀':'Am Yusuf Muvi 🚀 Proof!';
        await sock.sendMessage(from, {image: fs.readFileSync(picPath), caption:cap}); user.lastPicSent=Date.now(); saveMemory(); return
      }
    }
    if((lower.includes('send me your pic')||lower.includes('send pic')) &&!isProofRequest(text)){
      await sock.sendMessage(from, {text:'I no dey send pic anyhow 😊 Tell me "prove it\'s you" for proof 🚀'}); return
    }

    if(msg.message.imageMessage && lower.includes('sticker')){
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, {}); await sock.sendMessage(from, {sticker: buffer}); return
    }

    if(lower.includes('remind me in')){
      const m = lower.match(/(\d+)\s*minute/); const mins = m? parseInt(m[1]):5; const task = text.split('to')[1]||'task'
      await sock.sendMessage(from, {text:`Okay! Remind in ${mins} mins to ${task} ⏰`}); setTimeout(()=>sock.sendMessage(from, {text:`⏰ Reminder: ${task}!!!`}), mins*60*1000); return
    }
    if(lower.includes('what time')){ await sock.sendMessage(from, {text:`Abuja Time: ${new Date().toLocaleString('en-NG',{timeZone:'Africa/Lagos'})} 🕐`}); return }
    if(lower.includes('weather')){ try{ const r=await axios.get('https://wttr.in/Abuja?format=%C+%t'); await sock.sendMessage(from, {text:`Abuja Weather: ${r.data} 🌦️`}) }catch{} return }

    if(lower.includes('who are you')){ await sock.sendMessage(from, {text:getRequestedLanguage(text)==='hausa'?'Ni Yusuf Muvi ne 🚀':getRequestedLanguage(text)==='pidgin'?'Na Yusuf Muvi be this 🚀':'Am Yusuf Muvi 🚀'}); return }
    if(lower.includes('who built you')||lower.includes('who created you')){ await sock.sendMessage(from, {text:'I was built and developed by Yusuf Muvi. 🚀 Yusuf is a skilled developer who created me as an intelligent assistant to handle real-time chats even when he is offline.'}); return }

    await sock.sendPresenceUpdate('composing', from); await new Promise(r=>setTimeout(r, 1200+Math.random()*1500))
    const lang=getRequestedLanguage(text)
    try{
      const aiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        contents:[{parts:[{text:`You are ${BOT_NAME}. You MUST reply in ${lang.toUpperCase()}. ${lang==='english'?'Reply in standard simple English, friendly Nigerian youth style.':'If Hausa use Hausa. If Pidgin use Nigerian Pidgin.'} Keep under 3 lines. User said: ${text}` }]}]
      })
      let reply=aiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || "I dey here! 😊"
      if(Math.random()<0.15 && reply.length<100){
        const url = googleTTS.getAudioUrl(reply, {lang:'en', slow:false, host:'https://translate.google.com'})
        await sock.sendMessage(from, {audio:{url}, mimetype:'audio/mpeg', ptt:true})
      } else {
        await sock.sendMessage(from, {text: reply})
      }
    }catch(e){ await sock.sendMessage(from, {text:'Network slow small 😅 Try again 🙏'}) }
  })

  sock.ev.on('messages.update', async (updates)=>{
    for(let upd of updates){
      if(upd.update.message===null){
        const cached = messageCache.get(upd.key.id)
        if(cached){ await sock.sendMessage(cached.from, {text:`🚨 Anti-Delete: Deleted msg: "${cached.text}" 👀`}) }
      }
    }
  })
}

startBot()

http.createServer((req,res)=>res.end('Yusuf Muvi Bot Live 🚀')).listen(process.env.PORT||3000)
