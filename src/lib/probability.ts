import { Team } from '@/types';

// Historical seed matchup upset rates (lower seed wins), 1985-2025
// [higherSeed][lowerSeed] = probability lower seed wins
export const HISTORICAL_UPSET_RATES: Record<string, number> = {
  '1v16': 0.01,
  '2v15': 0.06,
  '3v14': 0.15,
  '4v13': 0.21,
  '5v12': 0.36,
  '6v11': 0.37,
  '7v10': 0.40,
  '8v9': 0.47,
  '1v9': 0.02,
  '1v8': 0.03,
  '2v10': 0.07,
  '2v7': 0.20,
  '3v11': 0.18,
  '3v6': 0.30,
  '4v12': 0.23,
  '4v5': 0.43,
};

export function getHistoricalUpsetRate(team1Seed: number, team2Seed: number): number {
  const higher = Math.min(team1Seed, team2Seed);
  const lower = Math.max(team1Seed, team2Seed);
  const key = `${higher}v${lower}`;
  return HISTORICAL_UPSET_RATES[key] ?? 0.35;
}

// KenPom logistic model: 1 / (1 + 10^(-marginDiff/11))
function kenpomLogistic(team1: Team, team2: Team): number {
  const marginDiff = team1.kenpom.adjEM - team2.kenpom.adjEM;
  return 1 / (1 + Math.pow(10, -marginDiff / 11));
}

// Log5 method using KenPom win% approximation
function log5(team1: Team, team2: Team): number {
  // Approximate win% from AdjEM using logistic
  const p1 = 1 / (1 + Math.pow(10, -team1.kenpom.adjEM / 22));
  const p2 = 1 / (1 + Math.pow(10, -team2.kenpom.adjEM / 22));
  // Log5 formula
  return (p1 * (1 - p2)) / (p1 * (1 - p2) + p2 * (1 - p1));
}

// Seed-based probability from historical data
function seedBased(team1: Team, team2: Team): number {
  const higher = team1.seed < team2.seed ? team1 : team2;
  const lower = team1.seed < team2.seed ? team2 : team1;
  const lowerWinRate = getHistoricalUpsetRate(higher.seed, lower.seed);
  return team1.seed < team2.seed ? 1 - lowerWinRate : lowerWinRate;
}

// Ensemble: 60% KenPom, 25% Log5, 15% Seed
export function ensembleWinProbability(team1: Team, team2: Team): number {
  const kp = kenpomLogistic(team1, team2);
  const l5 = log5(team1, team2);
  const sb = seedBased(team1, team2);
  return 0.60 * kp + 0.25 * l5 + 0.15 * sb;
}

export function getQualitativeEdge(prob: number): string {
  if (prob >= 0.80) return 'clear favorite';
  if (prob >= 0.65) return 'favored';
  if (prob >= 0.55) return 'slight edge';
  return 'toss-up';
}

export function isUpset(winner: Team, loser: Team): boolean {
  return winner.seed > loser.seed;
}

// Expected upsets per round (historical averages)
export const EXPECTED_UPSETS_PER_ROUND: Record<string, number> = {
  'First Four': 2,
  'Round of 64': 11,
  'Round of 32': 5,
  'Sweet 16': 3,
  'Elite Eight': 2,
  'Final Four': 1,
  'Championship': 0.5,
};

export function getCalibrationNudge(upsetCount: number, totalGames: number, round: string): string {
  const expectedSoFar = getExpectedUpsetsSoFar(totalGames, round);
  const diff = upsetCount - expectedSoFar;

  if (diff <= -3) {
    return 'CALIBRATION: The bracket is running unusually chalky. When legitimate upset indicators exist (KenPom rank vs seed divergence, luck regression, SOS gaps, tempo advantages), lean toward the underdog.';
  }
  if (diff >= 3) {
    return 'CALIBRATION: The bracket has seen a lot of chaos. Unless clear upset indicators are present, give more weight to the higher-seeded team\'s track record and efficiency advantages.';
  }
  return '';
}

function getExpectedUpsetsSoFar(totalGames: number, round: string): number {
  // Rough approximation of cumulative expected upsets
  const rates: Record<string, number> = {
    'First Four': 0.5,
    'Round of 64': 0.375,
    'Round of 32': 0.31,
    'Sweet 16': 0.30,
    'Elite Eight': 0.28,
    'Final Four': 0.25,
    'Championship': 0.22,
  };
  return totalGames * (rates[round] ?? 0.33);
}
