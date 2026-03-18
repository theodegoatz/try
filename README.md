# March Madness Arena

AI-powered 2026 NCAA Tournament bracket simulation. Watch all 67 games unfold live.

---

## Deploy to Vercel (free hosting)

**Step 1 — Get a free Groq API key (no credit card)**
1. Go to **[console.groq.com](https://console.groq.com)** and sign up
2. Click **API Keys** → **Create API Key**, copy it

**Step 2 — Deploy to Vercel**
1. Go to **[vercel.com](https://vercel.com)** and sign up with GitHub
2. Click **Add New Project** → import `theodegoatz/try`
3. Before clicking Deploy, open **Environment Variables** and add:
   ```
   Name:  GROQ_API_KEY
   Value: your_key_from_step_1
   ```
4. Click **Deploy**

That's it — Vercel gives you a live URL like `https://your-app.vercel.app`.

---

## Run locally

```bash
git clone https://github.com/theodegoatz/try
cd try
npm install
cp .env.local.example .env.local
# Edit .env.local and add GROQ_API_KEY=your_key
npm run dev
# → http://localhost:3000
```

---

## Other API key options

| Provider | Cost | Limit | Key name |
|----------|------|-------|----------|
| **Groq** (recommended) | Free | ~30 req/min | `GROQ_API_KEY` |
| Google Gemini | Free | ~20 req/day | `GEMINI_API_KEY` |
| Anthropic Claude | ~$0.03/sim | High | `ANTHROPIC_API_KEY` |

The app auto-detects whichever key you set (priority: Groq > Anthropic > Gemini).

---

## How It Works

- **68 teams** with real 2026 KenPom stats (AdjEM, AdjO, AdjD, Tempo, Luck, SOS)
- **Ensemble win probability**: 60% KenPom logistic + 25% Log5 + 15% seed-based historical rates
- Each game prompt uses qualitative edge framing (not raw %) so the AI analyzes matchups
- Dynamic upset calibration keeps results historically realistic
- Client calls `/api/simulate-game` once per game — fast, works on Vercel free tier
