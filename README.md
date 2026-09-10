# ZEHRIN AI — React + Gemini + Firebase

## Is upgrade mein kya-kya naya hai

1. **Poora React (.jsx) mein convert kiya** — `src/App.jsx`, `src/components/*`,
   `src/hooks/useHologram.js`, `src/lib/speech.js`. Three.js hologram ab ek
   custom hook mein hai, cleanup ke saath.
2. **Background mein "ZEHRIN" bada text + neeche chhota full form**:
   *Zero Error Human-like Reasoning & Intelligence Network*.
3. **Emoji ab bola nahi jaata** — TTS se pehle emojis (😊, 🎉, etc.) strip ho
   jaate hain, sirf visible text mein rehte hain.
4. **Voice speed badhaya** — rate `.93` se `1.15` kar diya, samajh mein bhi
   aayegi aur pehle se tez bhi lagegi.
5. **Word-by-word streaming reply** — backend ab Gemini se streaming response
   leta hai aur Server-Sent-Events (SSE) ke through frontend ko chunk-by-chunk
   bhejta hai, jo turant screen par dikhta jaata hai (poora response ready hone
   ka wait nahi karna padta).
6. **3-file memory system, Firebase Realtime Database mein**:
   - `information` → ZEHRIN/user ke baare mein permanent facts (naam, DOB,
     nickname, personality, speaking style, etc.)
   - `shortMemory` → chhoti-mein baatein/notes
   - `chats` → puri conversation history (context ke liye last 12 messages
     har request mein use hoti hain)
   
   Gemini ko **function-calling tools** diye gaye hain
   (`update_information`, `delete_information`, `add_short_memory`,
   `delete_short_memory`). Jab tum bologe "maine tumhara nickname bestai rakha
   hai", ZEHRIN khud decide karke Firebase mein us fact ko add/update/delete
   karti hai — aur UI mein top-left corner mein chhota sa log dikhta hai
   (jaise "✏️ Updated: userNickname → bestai").
7. **UI upgrade** — glass-style scrollable chat panel (lambe replies ab scroll
   ho sakte hain, overflow nahi hote), user aur ZEHRIN ke messages alag
   background/color mein (ab text background se mix nahi hota), Orbitron font
   se futuristic branding.

## Firebase setup

Tumhara diya hua Firebase config already `server/firebaseClient.js` mein
default ke roop mein daal diya hai, isliye kuch extra setup nahi chahiye.
Bas **Firebase Console → Realtime Database → Rules** check kar lena — agar
abhi "test mode" (`.read`/`.write`: true) hai to sirf apne personal use ke
liye theek hai, lekin public deploy karne se pehle proper auth rules laga
lena, kyunki `apiKey` jaisa web config secret nahi hota, database rules hi
security dete hain.

Chaho to `.env` mein `FIREBASE_*` variables set karke defaults override kar
sakte ho (dekh lo `.env.example`).

## Requirements
- Node.js 18+
- Gemini API key (https://aistudio.google.com/apikey)
- Firebase Realtime Database (already configured)

## Setup
```
cp .env.example .env
```
`.env` kholke apni Gemini key daalo, phir:
```
npm install
npm run dev
```
Terminal mein diya URL kholo (normally `http://localhost:5173`).

## Production
```
npm run build
npm start
```
`npm start` akela hi built frontend + API dono serve kar dega.

## Notes
- Model `gemini-3.6-flash` use ho raha hai (current stable, fast). `.env`
  mein `GEMINI_MODEL` set karke badal sakte ho.
- `thinkingConfig: { thinkingBudget: 0 }` set hai taaki Gemini bina extra
  internal reasoning ke seedha jawab de — casual chat ke liye fast rehta hai.
- Memory function-calls ke case mein 2 Gemini calls lagti hain (thoda slow),
  lekin normal chat messages single streaming call mein hi turant aane
  lagte hain.
