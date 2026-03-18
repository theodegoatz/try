import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { Team, Matchup, BracketState, RoundName, AIGameResult, SimulationEvent } from '@/types';
import { ensembleWinProbability, getQualitativeEdge, getCalibrationNudge, isUpset } from './probability';
import { updateBracketAfterGame } from './bracket';

// Provider detection — use whichever key is available
// Priority: Groq (free, best limits) > Anthropic (paid) > Gemini (free but low daily limit)
function getProvider(): 'groq' | 'anthropic' | 'gemini' | null {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY) return 'gemini';
  return null;
}

function formatTeamProfile(team: Team): string {
  const tier = team.programTier === 'blueblood' ? 'Blue Blood program'
    : team.programTier === 'power_conference' ? 'Power conference program'
    : team.programTier === 'mid_major' ? 'Mid-major program'
    : 'Cinderella / small program';

  const cinderellaNote = team.isCinderella ? ' (potential Cinderella)' : '';
  const luckNote = team.kenpom.luck > 0.03 ? ' [LUCK: Overperforming record vs efficiency — regression risk]'
    : team.kenpom.luck < -0.03 ? ' [LUCK: Underperforming — better than record suggests]'
    : '';

  return `**${team.name}** (${team.seed}-seed, ${team.conference}, ${team.record || 'N/A'}) — ${tier}${cinderellaNote}
  KenPom Rank: #${team.kenpom.rank} | AdjEM: ${team.kenpom.adjEM.toFixed(1)} | AdjO: ${team.kenpom.adjO.toFixed(1)} | AdjD: ${team.kenpom.adjD.toFixed(1)}
  Tempo: ${team.kenpom.adjT.toFixed(1)} poss/40min | SOS Rank: #${team.kenpom.sos}${luckNote}`;
}

function getTempoAnalysis(team1: Team, team2: Team): string {
  const diff = Math.abs(team1.kenpom.adjT - team2.kenpom.adjT);
  const faster = team1.kenpom.adjT > team2.kenpom.adjT ? team1 : team2;
  const slower = team1.kenpom.adjT > team2.kenpom.adjT ? team2 : team1;

  if (diff < 2) return 'Similar tempo — neutral pace clash.';
  if (diff < 5) return `Mild tempo mismatch: ${faster.name} prefers faster pace (${faster.kenpom.adjT.toFixed(1)}) vs ${slower.name} (${slower.kenpom.adjT.toFixed(1)}).`;
  return `Significant tempo clash: ${faster.name} wants to run (${faster.kenpom.adjT.toFixed(1)}) vs ${slower.name}'s deliberate pace (${slower.kenpom.adjT.toFixed(1)}). Whoever controls tempo gains a major edge.`;
}

function getDefensiveAnalysis(team1: Team, team2: Team): string {
  const notes: string[] = [];
  if (team1.kenpom.adjD <= 88) notes.push(`${team1.name} has elite defense (AdjD: ${team1.kenpom.adjD.toFixed(1)}, Top 25) — can grind out close games.`);
  if (team2.kenpom.adjD <= 88) notes.push(`${team2.name} has elite defense (AdjD: ${team2.kenpom.adjD.toFixed(1)}, Top 25) — can grind out close games.`);

  if (team1.kenpom.adjO >= 120 && team2.kenpom.adjD <= 90) {
    notes.push(`Style clash: ${team1.name}'s elite offense vs ${team2.name}'s strong defense — treated as nearly a coin flip in March.`);
  }
  if (team2.kenpom.adjO >= 120 && team1.kenpom.adjD <= 90) {
    notes.push(`Style clash: ${team2.name}'s elite offense vs ${team1.name}'s strong defense — treated as nearly a coin flip in March.`);
  }

  return notes.length > 0 ? notes.join(' ') : 'No elite defensive advantages identified.';
}

function buildGamePrompt(
  team1: Team,
  team2: Team,
  round: RoundName,
  venue: string,
  upsetCount: number,
  totalGames: number,
): string {
  const prob = ensembleWinProbability(team1, team2);
  const qualEdge = getQualitativeEdge(prob);
  const calibration = getCalibrationNudge(upsetCount, totalGames, round);

  const seedVsKenpom1 = team1.kenpom.rank < team1.seed * 4 ? `${team1.name}'s KenPom rank (#${team1.kenpom.rank}) is much better than their seed implies.` : '';
  const seedVsKenpom2 = team2.kenpom.rank < team2.seed * 4 ? `${team2.name}'s KenPom rank (#${team2.kenpom.rank}) is much better than their seed implies.` : '';

  const upsetIndicators = [seedVsKenpom1, seedVsKenpom2].filter(Boolean).join(' ');

  return `You are an elite March Madness analyst filling out a bracket to win a pool. Analyze this ${round} matchup and pick a winner.

MATCHUP: ${team1.name} vs ${team2.name}
ROUND: ${round}
VENUE: ${venue}

TEAM PROFILES:
${formatTeamProfile(team1)}

${formatTeamProfile(team2)}

MATCHUP ANALYSIS:
Overall Edge: ${team1.name} has a **${qualEdge}** based on ensemble efficiency model (KenPom logistic 60% + Log5 25% + seed-based 15%).
Defensive Notes: ${getDefensiveAnalysis(team1, team2)}
Tempo Notes: ${getTempoAnalysis(team1, team2)}
${upsetIndicators ? `Upset Indicators: ${upsetIndicators}` : ''}

KENPOM FACTORS THAT MATTER MOST IN MARCH:
- Elite defense (AdjD top 25) grinds out close games — huge advantage in tournament
- Tempo control can neutralize more talented opponents
- Elite offense vs elite defense = treat as near coin flip
- Teams with high luck scores may regress to their true efficiency

HISTORICAL SEED DATA (1985-2025):
- ${team1.seed}v${team2.seed} matchups: ${team1.seed > team2.seed ? `${team2.seed}-seeds win ~${Math.round((1 - 0.35) * 100)}% of the time` : `${team1.seed}-seeds win historically at high rates`}
- This is a ${round} game — pressure and experience matter

TOURNAMENT CONTEXT:
- Upsets so far: ${upsetCount} / ${totalGames} games played
- You are trying to produce a REALISTIC bracket with historically accurate upset rates
${calibration ? `\n${calibration}` : ''}

Pick the winner and provide 2-3 sentences of analysis. Be decisive — pick one team. Consider upset potential but don't force chaos if the better team truly should win.

Respond with JSON only: {"winner": "EXACT team name", "reasoning": "2-3 sentence analysis"}`;
}

function parseAIResponse(text: string, team1: Team, team2: Team): AIGameResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from response: ${text.slice(0, 200)}`);
  }

  const result = JSON.parse(jsonMatch[0]) as AIGameResult;

  // Validate winner matches one of the two teams
  const winnerName = result.winner.toLowerCase();
  if (!team1.name.toLowerCase().includes(winnerName) && !team2.name.toLowerCase().includes(winnerName)) {
    result.winner = team1.kenpom.rank < team2.kenpom.rank ? team1.name : team2.name;
  }

  return result;
}

async function simulateWithAnthropic(prompt: string, team1: Team, team2: Team): Promise<AIGameResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return parseAIResponse(content.text, team1, team2);
}

// Small delay between Gemini calls to avoid burst rate limits
const GEMINI_MIN_DELAY_MS = 1200; // 1.2s between calls (~50 RPM)
let lastGeminiCallAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateWithGemini(prompt: string, team1: Team, team2: Team): Promise<AIGameResult> {
  // Enforce rate limit
  const now = Date.now();
  const elapsed = now - lastGeminiCallAt;
  if (elapsed < GEMINI_MIN_DELAY_MS) {
    await sleep(GEMINI_MIN_DELAY_MS - elapsed);
  }
  lastGeminiCallAt = Date.now();

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-lite-latest',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  });

  // Retry up to 3 times with exponential backoff on 429
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseAIResponse(text, team1, team2);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 = lastError.message.includes('429') || lastError.message.includes('quota') || lastError.message.includes('RESOURCE_EXHAUSTED');
      if (is429 && attempt < 2) {
        const backoff = GEMINI_MIN_DELAY_MS * Math.pow(2, attempt + 1);
        await sleep(backoff);
        lastGeminiCallAt = Date.now();
      } else {
        throw lastError;
      }
    }
  }
  throw lastError!;
}

async function simulateWithGroq(prompt: string, team1: Team, team2: Team): Promise<AIGameResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are an expert NCAA Tournament analyst. Always respond with valid JSON only, no markdown fences.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content || '';
  return parseAIResponse(text, team1, team2);
}

export async function simulateGame(
  team1: Team,
  team2: Team,
  round: RoundName,
  venue: string,
  upsetCount: number,
  totalGames: number,
): Promise<AIGameResult> {
  const prompt = buildGamePrompt(team1, team2, round, venue, upsetCount, totalGames);
  const provider = getProvider();

  if (provider === 'groq') {
    return simulateWithGroq(prompt, team1, team2);
  } else if (provider === 'anthropic') {
    return simulateWithAnthropic(prompt, team1, team2);
  } else if (provider === 'gemini') {
    return simulateWithGemini(prompt, team1, team2);
  } else {
    throw new Error(
      'No AI provider configured. Options:\n' +
      '1. FREE (recommended): Get a Groq key at console.groq.com — set GROQ_API_KEY in .env.local\n' +
      '2. FREE (limited): Get a Gemini key at aistudio.google.com — set GEMINI_API_KEY in .env.local\n' +
      '3. Paid: Get an Anthropic key at console.anthropic.com — set ANTHROPIC_API_KEY in .env.local'
    );
  }
}

export async function* runSimulation(
  bracket: BracketState,
): AsyncGenerator<SimulationEvent> {
  let currentBracket = bracket;
  let upsetCount = 0;
  let totalGames = 0;

  const processMatchup = async (
    matchup: Matchup,
    bracketRef: BracketState,
  ): Promise<{ winner: Team; loser: Team; reasoning: string; matchupIsUpset: boolean; updatedBracket: BracketState }> => {
    if (!matchup.team1 || !matchup.team2) {
      throw new Error(`Matchup ${matchup.id} has missing teams`);
    }

    const result = await simulateGame(
      matchup.team1,
      matchup.team2,
      matchup.round,
      matchup.venue || 'TBD',
      upsetCount,
      totalGames,
    );

    const winnerName = result.winner.toLowerCase();
    const winner = winnerName.includes(matchup.team1.name.toLowerCase()) ||
      matchup.team1.name.toLowerCase().includes(winnerName)
      ? matchup.team1
      : matchup.team2;
    const loser = winner.id === matchup.team1.id ? matchup.team2 : matchup.team1;

    const matchupIsUpset = isUpset(winner, loser);
    const updatedBracket = updateBracketAfterGame(bracketRef, matchup.id, winner);

    return { winner, loser, reasoning: result.reasoning, matchupIsUpset, updatedBracket };
  };

  // First Four
  yield { type: 'status', message: 'Starting First Four play-in games...', round: 'First Four' };

  for (const matchup of currentBracket.firstFour) {
    if (!matchup.team1 || !matchup.team2) continue;
    try {
      const { winner, loser, reasoning, matchupIsUpset, updatedBracket } = await processMatchup(matchup, currentBracket);
      currentBracket = updatedBracket;
      totalGames++;
      if (matchupIsUpset) upsetCount++;

      yield {
        type: 'game_result',
        matchupId: matchup.id,
        winner,
        loser,
        reasoning,
        isUpset: matchupIsUpset,
        round: 'First Four',
        upsetCount,
        totalGames,
        bracketState: currentBracket,
      };
    } catch (e) {
      yield { type: 'error', message: `Error simulating ${matchup.team1?.name} vs ${matchup.team2?.name}: ${String(e)}` };
    }
  }

  yield { type: 'round_complete', round: 'First Four', upsetCount, totalGames };

  // Main bracket rounds
  const rounds: Array<{ key: keyof BracketState; name: RoundName }> = [
    { key: 'roundOf64', name: 'Round of 64' },
    { key: 'roundOf32', name: 'Round of 32' },
    { key: 'sweet16', name: 'Sweet 16' },
    { key: 'eliteEight', name: 'Elite Eight' },
    { key: 'finalFour', name: 'Final Four' },
  ];

  for (const { key, name } of rounds) {
    yield { type: 'status', message: `Simulating ${name}...`, round: name };

    const matchups = currentBracket[key] as Matchup[];

    for (const matchup of matchups) {
      const freshMatchup = matchups.find(m => m.id === matchup.id);
      if (!freshMatchup?.team1 || !freshMatchup?.team2) continue;

      try {
        const { winner, loser, reasoning, matchupIsUpset, updatedBracket } = await processMatchup(freshMatchup, currentBracket);
        currentBracket = updatedBracket;
        totalGames++;
        if (matchupIsUpset) upsetCount++;

        yield {
          type: 'game_result',
          matchupId: freshMatchup.id,
          winner,
          loser,
          reasoning,
          isUpset: matchupIsUpset,
          round: name,
          upsetCount,
          totalGames,
          bracketState: currentBracket,
        };
      } catch (e) {
        yield {
          type: 'error',
          message: `Error simulating game in ${name}: ${String(e)}`,
        };
      }
    }

    yield { type: 'round_complete', round: name, upsetCount, totalGames };
  }

  // Championship
  yield { type: 'status', message: 'Simulating the Championship game...', round: 'Championship' };

  const championship = currentBracket.championship;
  if (championship.team1 && championship.team2) {
    try {
      const { winner, loser, reasoning, matchupIsUpset, updatedBracket } = await processMatchup(championship, currentBracket);
      currentBracket = updatedBracket;
      currentBracket.champion = winner;
      totalGames++;
      if (matchupIsUpset) upsetCount++;

      yield {
        type: 'game_result',
        matchupId: championship.id,
        winner,
        loser,
        reasoning,
        isUpset: matchupIsUpset,
        round: 'Championship',
        upsetCount,
        totalGames,
        bracketState: currentBracket,
      };
    } catch (e) {
      yield { type: 'error', message: `Error simulating Championship: ${String(e)}` };
    }
  }

  yield {
    type: 'simulation_complete',
    upsetCount,
    totalGames,
    bracketState: currentBracket,
    message: `Simulation complete! ${currentBracket.champion?.name || 'Unknown'} wins the 2026 NCAA Tournament with ${upsetCount} total upsets across ${totalGames} games.`,
  };
}

export { getProvider };
