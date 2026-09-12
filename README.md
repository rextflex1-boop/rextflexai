# RextFlex Ai — Chat UI (standalone)

Ek text-based AI chat app — login, chat history, web search, file upload,
voice input, personas, share links, aur PWA install, sab ke sath. Groq ke
`moonshotai/kimi-k3` model se powered.

## Setup (poora, ek baar)

1. **Neon database** — connection string lo (Neon Console → Connection Details).
2. `db/schema.sql` ko us database pe run karo — dubara run karna hamesha safe
   hai (`IF NOT EXISTS` sab jagah hai).
3. **Auth secret**: `openssl rand -base64 32`.
4. **Google login**: Google Cloud Console → Credentials → OAuth client ID →
   Web application → redirect URI = `https://<domain>/api/auth/callback/google`.
5. Vercel → Settings → Environment Variables mein daalo:
   - `DATABASE_URL`, `GROQ_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
     `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
6. Redeploy.

> Better-auth tables best-effort hain (version 1.6.26). Agar sign-in mein DB
> error aaye: `npx @better-auth/cli generate` chalao.

## 7 naye features

1. **Web search** (`lib/web-search.ts`) — AI khud decide karta hai kab search
   karna hai (recent/uncertain info). Ye DuckDuckGo ke free HTML results
   scrape karta hai (koi API key nahi chahiye) — **isliye thoda fragile hai**:
   DuckDuckGo apna markup badle toh ye tootega. Testing ke liye theek hai;
   production ke liye Tavily/Serper/Bing jaisa paid provider use karna better
   hoga (`lib/web-search.ts` mein bas ek function replace karna hai).
2. **File/image upload** — composer mein paperclip button. Attach kiya hua
   file seedha message ke sath jaata hai. **Note**: model (`kimi-k3`) images
   samajhta hai ya nahi ye maine verify nahi kiya — agar nahi samajhta,
   AI politely bol dega ki nahi dekh pa raha. Vision-capable model pe switch
   karoge toh ye automatically kaam karne lagega.
3. **Voice input** — mic button, browser ka built-in speech-to-text use karta
   hai (koi API/key nahi chahiye). Android Chrome pe achha kaam karta hai;
   Safari/Firefox mein support kam/nahi hai — wahan button hi nahi dikhega.
4. **Regenerate** — last AI reply ke neeche "Regenerate" link, naya jawab
   generate karta hai.
5. **Share chat** — sidebar mein chat ke "..." menu → "Share" — link copy ho
   jata hai, koi bhi (bina login) us chat ko read-only dekh sakta hai
   (`/share/[id]`). Chat mein naye messages iss link mein automatically nahi
   aayenge jab tak dubara na share karo — wo bas ek snapshot-style live view
   hai (jo bhi us waqt DB mein hai wahi dikhta hai, refresh pe latest).
6. **Personas** — Settings → "Persona" section. Naya persona banao (naam +
   instructions), select karo — turant active ho jata hai, chat ke system
   prompt mein use hota hai. "Default" persona = neeche wala free-text tone.
7. **PWA (installable)** — `app/manifest.ts` + generated icons
   (`app/icon.tsx`, `app/icon1.tsx`, `app/apple-icon.tsx`) + minimal service
   worker (`public/sw.js`, no caching — redeploy pe kabhi stale content nahi
   dikhega). Android Chrome pe "Add to Home Screen" ka prompt aana chahiye
   deploy karne ke baad (HTTPS zaroori hai — Vercel pe automatically hai).

**Rate limiting jaan-bujh kar nahi lagayi** — abhi testing phase hai. Jab
production mein jao, isko add karna zaroor sochna (Groq key ka misuse na ho).

## Baaki sab (pehle se hai)

- `components/ai-elements/` + `components/ui/` — chat UI kit.
- `components/chat/rextflex-chat.tsx`, `chat-message.tsx` — main chat.
- `app/api/chat/route.ts` — Groq `llama-3.1-8b-instant`, DB persistence,
  webSearch tool, active persona/tone.
- `lib/auth.ts`, `lib/auth-client.ts` — better-auth (email+password + Google).
- `components/chat/sidebar.tsx` — chats list (search, rename, delete, share).
- `components/chat/settings-dialog.tsx` — Theme, Persona, AI tone.

## Chalane ke liye (local)

```bash
npm install
cp .env.example .env.local
npm run dev
```

`http://localhost:3000` khol lo. Google login local pe test karne ke liye
`http://localhost:3000/api/auth/callback/google` bhi Google Console mein add
karna hoga.


## RextFlex AI feature pack

This build keeps the existing Groq + E2B architecture intact and adds: real Stop Response aborting, temporary chats, Markdown/JSON export, pin/favorite chat controls, improved chat search/sorting, global drag-and-drop attachments, edit & resend for user messages, saved prompts, local usage stats, theme controls, personas/tone presets, web search and thinking toggles, share/rename/delete, and responsive mobile/PWA behavior.

Run `db/schema.sql` after pulling this version so the chat session pin/favorite columns are present. No Gemini or NVIDIA credentials are required.
