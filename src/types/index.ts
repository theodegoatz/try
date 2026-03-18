export type Region = 'East' | 'West' | 'South' | 'Midwest';
export type ProgramTier = 'blueblood' | 'power_conference' | 'mid_major' | 'cinderella';

export interface KenPomStats {
  rank: number;
  adjEM: number;
  adjO: number;
  adjD: number;
  adjT: number;
  luck: number;
  sos: number; // strength of schedule rank (lower = harder)
}

export interface Team {
  id: string;
  name: string;
  seed: number;
  region: Region;
  conference: string;
  programTier: ProgramTier;
  isCinderella: boolean;
  kenpom: KenPomStats;
  espnId?: number;
  record?: string;
}

export type RoundName =
  | 'First Four'
  | 'Round of 64'
  | 'Round of 32'
  | 'Sweet 16'
  | 'Elite Eight'
  | 'Final Four'
  | 'Championship';

export interface Matchup {
  id: string;
  round: RoundName;
  region?: Region; // undefined for Final Four and Championship
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  reasoning?: string;
  isUpset?: boolean;
  venue?: string;
}

export interface BracketState {
  firstFour: Matchup[];
  roundOf64: Matchup[];
  roundOf32: Matchup[];
  sweet16: Matchup[];
  eliteEight: Matchup[];
  finalFour: Matchup[];
  championship: Matchup;
  champion: Team | null;
}

export interface SimulationEvent {
  type: 'game_result' | 'round_complete' | 'simulation_complete' | 'error' | 'status';
  matchupId?: string;
  winner?: Team;
  loser?: Team;
  reasoning?: string;
  isUpset?: boolean;
  round?: RoundName;
  upsetCount?: number;
  totalGames?: number;
  message?: string;
  bracketState?: BracketState;
}

export interface GamePromptData {
  team1: Team;
  team2: Team;
  round: RoundName;
  venue: string;
  upsetCount: number;
  totalGames: number;
  expectedUpsets: number;
}

export interface AIGameResult {
  winner: string; // team name
  reasoning: string;
}
