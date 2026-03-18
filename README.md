# March Madness Arena

An AI-powered 2026 NCAA Tournament bracket simulation using real KenPom statistical data and your choice of AI provider.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get an API key

**Option A — FREE and recommended: Groq**
No credit card, no billing. ~30 requests/minute — enough to run a full 67-game simulation in under 3 minutes.

1. Go to [console.groq.com](https://console.groq.com) and sign up (free)
2. Create an API key under **API Keys**

```bash
cp .env.local.example .env.local
# Edit .env.local:
GROQ_API_KEY=your_key_here
```

**Option B — Free (limited): Google Gemini**
Get a key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Note: the free tier has a ~20 requests/day cap for some model tiers, which may limit you to a partial simulation.

```
GEMINI_API_KEY=your_key_here
```

**Option C — Paid: Anthropic Claude**
Uses claude-haiku-4-5. Full 67-game simulation costs ~$0.03.

```
ANTHROPIC_API_KEY=your_key_here
```

The app auto-detects whichever key is present (priority: Groq > Anthropic > Gemini).

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Start Simulation**.

---

## How It Works

The app simulates the entire 68-team NCAA Tournament bracket game-by-game, streaming results in real-time. Each game goes through:

1. **Ensemble win probability** — 60% KenPom logistic model + 25% Log5 + 15% seed-based historical rates
2. **Qualitative edge framing** — probability converted to "toss-up / slight edge / favored / clear favorite" so the AI analyzes the matchup rather than anchoring on a number
3. **AI game simulation** — prompt includes team profiles, KenPom stats, tempo analysis, defensive analysis, luck regression signals, historical seed upset rates, and venue context
4. **Upset calibration** — running tracker compares actual upsets to historical averages and nudges the AI when the bracket is too chalky or too chaotic

## 2026 Bracket

| Seed | East | West | Midwest | South |
|------|------|------|---------|-------|
| 1 | Duke | Arizona | Michigan | Florida |
| 2 | UConn | Purdue | Iowa State | Houston |
| 3 | Michigan State | Gonzaga | Virginia | Illinois |
| 4 | Kansas | Arkansas | Alabama | Nebraska |
| 5 | St. John's | Wisconsin | Texas Tech | Vanderbilt |
| 6 | Louisville | BYU | Tennessee | North Carolina |
| 7 | UCLA | Miami (FL) | Kentucky | Saint Mary's |
| 8 | Ohio State | Villanova | Georgia | Clemson |

**First Four:** Texas/NC State (West 11), SMU/Miami (OH) (Midwest 11), Howard/UMBC (Midwest 16), Lehigh/Prairie View (South 16)

## Tech Stack

- **Next.js 16** — App Router, TypeScript, Server-Sent Events
- **Google Gemini 2.0 Flash** (free) or **Anthropic Claude Haiku 4.5** (paid)
- **Tailwind CSS**
