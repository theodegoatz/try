# March Madness Arena

An AI-powered 2026 NCAA Tournament bracket simulation using real KenPom statistical data and your choice of AI provider.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get an API key — FREE option available

**Option A — Free (Google Gemini):**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key** — no credit card, no billing required
3. Free tier gives you 1,500 requests/day and 1M tokens/day — more than enough for a full 67-game simulation

```bash
cp .env.local.example .env.local
# Edit .env.local:
GEMINI_API_KEY=your_key_here
```

**Option B — Paid (Anthropic Claude):**
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Add billing and create an API key
3. A full 67-game simulation costs roughly **$0.03** using claude-haiku-4-5

```bash
cp .env.local.example .env.local
# Edit .env.local:
ANTHROPIC_API_KEY=your_key_here
```

The app auto-detects which key you have — just set one and it works.

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
