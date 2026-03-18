# March Madness Arena

An AI-powered 2026 NCAA Tournament bracket simulation using real KenPom statistical data and Claude AI.

## How It Works

The app simulates the entire 68-team NCAA Tournament bracket game-by-game using Anthropic's Claude Haiku model. Results stream in real-time so you can watch the bracket unfold live.

**Tournament flow:** First Four → Round of 64 → Round of 32 → Sweet 16 → Elite Eight → Final Four → Championship

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Anthropic API key

```bash
cp .env.local.example .env.local
# Edit .env.local and add your key from https://console.anthropic.com/
```

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Simulate Bracket**.

## Features

- **68-team bracket** — Full 2026 NCAA Tournament including First Four play-in games
- **Real KenPom data** — Adjusted efficiency margins, offensive/defensive ratings, tempo, luck factor, and strength of schedule for all teams
- **Ensemble win probability** — 60% KenPom logistic + 25% Log5 + 15% seed-based historical rates
- **Qualitative edge framing** — The AI receives "slight edge" / "favored" / "clear favorite" instead of raw probabilities, so it analyzes matchups rather than anchoring on numbers
- **Tournament-specific analysis** — Elite defense weighting, tempo clash detection, luck regression signals, style clash identification
- **Dynamic upset calibration** — Tracks upsets vs historical averages and nudges the AI when too chalky or too chaotic
- **Live streaming** — Server-Sent Events stream each game result as it's decided
- **Historical seed data** — 1985–2025 upset rates embedded in every game prompt

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

- **Next.js 16** with App Router and TypeScript
- **Anthropic SDK** (`claude-haiku-4-5`, temperature 0.7)
- **Tailwind CSS** for styling
- **Server-Sent Events** for real-time streaming

## AI Model Details

Each game uses a structured prompt including:
- Team profiles with program tier (blueblood / power conference / mid-major / Cinderella)
- KenPom stats with qualitative edge framing (not raw percentages)
- Tournament-specific factors: elite defense, tempo control, style clashes, luck regression
- Historical upset rates for the specific seed matchup
- Running upset count vs expected for dynamic calibration
- Venue and travel context
