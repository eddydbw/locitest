# Loci

Photo prompts for philosophical thinking with children aged 7–11.

## What it does

1. Child picks a prompt (or gets a random one)
2. Takes a photo with their phone camera (or uploads one)
3. Claude asks a Socratic follow-up question based on the photo
4. Child responds by talking (voice-to-text) or typing
5. Up to 3 exchanges, then Claude captures a summary thought
6. Saved as a card — persistent across sessions per device

## Deploy to Vercel (step by step)

### 1. Get the code onto GitHub

```bash
# In the loci/ folder:
git init
git add .
git commit -m "initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/loci.git
git push -u origin main
```

### 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `loci` repository
4. Framework preset will auto-detect as **Next.js**
5. Click **Deploy** (it will fail on first deploy — that's expected, you need env vars next)

### 3. Add Vercel Postgres

1. In your Vercel project, go to **Storage** tab
2. Click **Create Database → Postgres**
3. Name it `loci-db`, keep defaults, click **Create**
4. Click **Connect to Project** — this auto-adds `POSTGRES_*` environment variables

### 4. Add your Anthropic API key

1. In Vercel project → **Settings → Environment Variables**
2. Add: `ANTHROPIC_API_KEY` = `your_key_here`
3. Apply to **Production**, **Preview**, and **Development**

### 5. Redeploy

Go to **Deployments** tab → click the three dots on the latest deploy → **Redeploy**.

The database tables are created automatically on first API call (no migration needed).

---

## Running locally

```bash
# Install dependencies
npm install

# Copy env template
cp .env.local.example .env.local
# Fill in ANTHROPIC_API_KEY
# For Postgres locally: either use a local Postgres instance
# or pull env vars from Vercel: npx vercel env pull .env.local

npm run dev
# → http://localhost:3000
```

## Project structure

```
loci/
├── app/
│   ├── api/
│   │   ├── chat/route.ts     ← Claude API calls (server-side)
│   │   ├── cards/route.ts    ← Save and fetch cards
│   │   └── session/route.ts  ← Device session management
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              ← All UI screens
├── components/
│   ├── CameraCapture.tsx
│   └── VoiceRecorder.tsx
├── lib/
│   ├── db.ts                 ← Vercel Postgres queries
│   └── prompts.ts            ← Prompt content + Claude system prompt
└── .env.local.example
```

## Customising prompts

Edit `lib/prompts.ts` — the `PROMPTS` array at the top.

## Customising Claude's behaviour

Edit the `SYSTEM_PROMPT` in `lib/prompts.ts`.

## Notes for testing sessions

- Each device gets a persistent `deviceId` stored in localStorage — no login required
- Photos are stored as base64 in the database (fine for testing; switch to object storage for scale)
- Voice recording uses the Web Speech API — works on Chrome and Safari, not Firefox
- The app falls back to text input automatically if voice is unavailable
- Cards persist across browser sessions and devices (by device ID, not browser)
