import { Team, Matchup, BracketState, Region, RoundName } from '@/types';
import { TEAMS_2026, getTeam } from './teams';

// Standard NCAA bracket seeding order within a region
// Each pair plays each other: (1v16), (8v9), (5v12), (4v13), (6v11), (3v14), (7v10), (2v15)
const ROUND_OF_64_PAIRINGS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
];

function makeMatchupId(round: string, region: string, index: number): string {
  return `${round.replace(/\s+/g, '_')}-${region}-${index}`;
}

function getTeamBySeedAndRegion(seed: number, region: Region): Team | undefined {
  return TEAMS_2026.find(t => t.seed === seed && t.region === region && !isPlayInOnlyTeam(t.id));
}

function isPlayInOnlyTeam(id: string): boolean {
  return ['nc-state', 'miami-oh', 'umbc', 'prairie-view'].includes(id);
}

export function buildFirstFour(): Matchup[] {
  return [
    {
      id: 'first-four-west-11',
      round: 'First Four',
      region: 'West',
      team1: getTeam('texas') || null,
      team2: getTeam('nc-state') || null,
      winner: null,
      venue: 'University of Dayton Arena, Dayton, OH',
    },
    {
      id: 'first-four-midwest-11',
      round: 'First Four',
      region: 'Midwest',
      team1: getTeam('smu') || null,
      team2: getTeam('miami-oh') || null,
      winner: null,
      venue: 'University of Dayton Arena, Dayton, OH',
    },
    {
      id: 'first-four-midwest-16',
      round: 'First Four',
      region: 'Midwest',
      team1: getTeam('howard') || null,
      team2: getTeam('umbc') || null,
      winner: null,
      venue: 'University of Dayton Arena, Dayton, OH',
    },
    {
      id: 'first-four-south-16',
      round: 'First Four',
      region: 'South',
      team1: getTeam('lehigh') || null,
      team2: getTeam('prairie-view') || null,
      winner: null,
      venue: 'University of Dayton Arena, Dayton, OH',
    },
  ];
}

function buildRegionRoundOf64(region: Region, firstFourWinners: Map<string, Team>): Matchup[] {
  const matchups: Matchup[] = [];
  const podVenues: Record<Region, [string, string]> = {
    East: ['PPG Paints Arena, Pittsburgh, PA', 'Greensboro Coliseum, Greensboro, NC'],
    West: ['Vivint Arena, Salt Lake City, UT', 'Footprint Center, Phoenix, AZ'],
    Midwest: ['T-Mobile Center, Kansas City, MO', 'Gainbridge Fieldhouse, Indianapolis, IN'],
    South: ['Toyota Center, Houston, TX', 'Dickies Arena, Fort Worth, TX'],
  };

  ROUND_OF_64_PAIRINGS.forEach(([highSeed, lowSeed], idx) => {
    const team1 = getTeamBySeedAndRegion(highSeed, region);
    let team2 = getTeamBySeedAndRegion(lowSeed, region);

    // Handle First Four winners filling in
    if (region === 'West' && lowSeed === 11) {
      team2 = firstFourWinners.get('first-four-west-11') || team2;
    }
    if (region === 'Midwest' && lowSeed === 11) {
      team2 = firstFourWinners.get('first-four-midwest-11') || team2;
    }
    if (region === 'Midwest' && lowSeed === 16) {
      team2 = firstFourWinners.get('first-four-midwest-16') || team2;
    }
    if (region === 'South' && lowSeed === 16) {
      team2 = firstFourWinners.get('first-four-south-16') || team2;
    }

    const venue = podVenues[region][idx < 4 ? 0 : 1];

    matchups.push({
      id: makeMatchupId('R64', region, idx),
      round: 'Round of 64',
      region,
      team1: team1 || null,
      team2: team2 || null,
      winner: null,
      venue,
    });
  });

  return matchups;
}

function buildNextRound(
  prevMatchups: Matchup[],
  round: RoundName,
  region?: Region,
  venue?: string,
): Matchup[] {
  const matchups: Matchup[] = [];
  for (let i = 0; i < prevMatchups.length; i += 2) {
    const m1 = prevMatchups[i];
    const m2 = prevMatchups[i + 1];
    if (!m1 || !m2) continue;

    const id = makeMatchupId(round.replace(/\s+/g, '_'), region || 'FF', Math.floor(i / 2));

    let roundVenue = venue;
    if (!roundVenue) {
      if (round === 'Sweet 16' || round === 'Elite Eight') {
        const regionalVenues: Record<Region, string> = {
          East: 'Capital One Arena, Washington, D.C.',
          West: 'SAP Center, San Jose, CA',
          Midwest: 'United Center, Chicago, IL',
          South: 'Toyota Center, Houston, TX',
        };
        roundVenue = region ? regionalVenues[region] : 'TBD';
      } else if (round === 'Final Four' || round === 'Championship') {
        roundVenue = 'Lucas Oil Stadium, Indianapolis, IN';
      }
    }

    matchups.push({
      id,
      round,
      region,
      team1: m1.winner,
      team2: m2.winner,
      winner: null,
      venue: roundVenue,
    });
  }
  return matchups;
}

export function initializeBracket(): BracketState {
  const firstFour = buildFirstFour();

  // Round of 64 with placeholder First Four winners (null until simulated)
  const ffWinners = new Map<string, Team>();
  const regions: Region[] = ['East', 'West', 'Midwest', 'South'];
  const roundOf64: Matchup[] = [];
  for (const region of regions) {
    roundOf64.push(...buildRegionRoundOf64(region, ffWinners));
  }

  // Build empty subsequent rounds
  const eastR64 = roundOf64.filter(m => m.region === 'East');
  const westR64 = roundOf64.filter(m => m.region === 'West');
  const midwestR64 = roundOf64.filter(m => m.region === 'Midwest');
  const southR64 = roundOf64.filter(m => m.region === 'South');

  const roundOf32: Matchup[] = [
    ...buildNextRound(eastR64, 'Round of 32', 'East'),
    ...buildNextRound(westR64, 'Round of 32', 'West'),
    ...buildNextRound(midwestR64, 'Round of 32', 'Midwest'),
    ...buildNextRound(southR64, 'Round of 32', 'South'),
  ];

  const eastR32 = roundOf32.filter(m => m.region === 'East');
  const westR32 = roundOf32.filter(m => m.region === 'West');
  const midwestR32 = roundOf32.filter(m => m.region === 'Midwest');
  const southR32 = roundOf32.filter(m => m.region === 'South');

  const sweet16: Matchup[] = [
    ...buildNextRound(eastR32, 'Sweet 16', 'East'),
    ...buildNextRound(westR32, 'Sweet 16', 'West'),
    ...buildNextRound(midwestR32, 'Sweet 16', 'Midwest'),
    ...buildNextRound(southR32, 'Sweet 16', 'South'),
  ];

  const eastS16 = sweet16.filter(m => m.region === 'East');
  const westS16 = sweet16.filter(m => m.region === 'West');
  const midwestS16 = sweet16.filter(m => m.region === 'Midwest');
  const southS16 = sweet16.filter(m => m.region === 'South');

  const eliteEight: Matchup[] = [
    ...buildNextRound(eastS16, 'Elite Eight', 'East'),
    ...buildNextRound(westS16, 'Elite Eight', 'West'),
    ...buildNextRound(midwestS16, 'Elite Eight', 'Midwest'),
    ...buildNextRound(southS16, 'Elite Eight', 'South'),
  ];

  const finalFour: Matchup[] = [
    {
      id: 'final-four-1',
      round: 'Final Four',
      team1: eliteEight[0]?.winner || null,
      team2: eliteEight[2]?.winner || null,
      winner: null,
      venue: 'Lucas Oil Stadium, Indianapolis, IN',
    },
    {
      id: 'final-four-2',
      round: 'Final Four',
      team1: eliteEight[1]?.winner || null,
      team2: eliteEight[3]?.winner || null,
      winner: null,
      venue: 'Lucas Oil Stadium, Indianapolis, IN',
    },
  ];

  const championship: Matchup = {
    id: 'championship',
    round: 'Championship',
    team1: finalFour[0]?.winner || null,
    team2: finalFour[1]?.winner || null,
    winner: null,
    venue: 'Lucas Oil Stadium, Indianapolis, IN',
  };

  return {
    firstFour,
    roundOf64,
    roundOf32,
    sweet16,
    eliteEight,
    finalFour,
    championship,
    champion: null,
  };
}

export function updateBracketAfterGame(
  bracket: BracketState,
  matchupId: string,
  winner: Team,
): BracketState {
  const newBracket = JSON.parse(JSON.stringify(bracket)) as BracketState;

  const allRounds = [
    newBracket.firstFour,
    newBracket.roundOf64,
    newBracket.roundOf32,
    newBracket.sweet16,
    newBracket.eliteEight,
    newBracket.finalFour,
    [newBracket.championship],
  ];

  // Set winner on the completed game
  for (const round of allRounds) {
    for (const matchup of round) {
      if (matchup.id === matchupId) {
        matchup.winner = winner;
        break;
      }
    }
  }

  // Advance winner to next round
  propagateWinner(newBracket, matchupId, winner);

  return newBracket;
}

function propagateWinner(bracket: BracketState, completedMatchupId: string, winner: Team): void {
  const advancementMap = buildAdvancementMap(bracket);
  const next = advancementMap[completedMatchupId];
  if (!next) return;

  const { targetMatchupId, slot } = next;
  const allRounds = [
    bracket.firstFour,
    bracket.roundOf64,
    bracket.roundOf32,
    bracket.sweet16,
    bracket.eliteEight,
    bracket.finalFour,
    [bracket.championship],
  ];

  for (const round of allRounds) {
    for (const matchup of round) {
      if (matchup.id === targetMatchupId) {
        if (slot === 1) matchup.team1 = winner;
        else matchup.team2 = winner;
        break;
      }
    }
  }
}

// Build map: completedMatchupId -> { targetMatchupId, slot (1 or 2) }
function buildAdvancementMap(bracket: BracketState): Record<string, { targetMatchupId: string; slot: 1 | 2 }> {
  const map: Record<string, { targetMatchupId: string; slot: 1 | 2 }> = {};

  function link(sources: Matchup[], targets: Matchup[]) {
    for (let i = 0; i < sources.length; i += 2) {
      const target = targets[Math.floor(i / 2)];
      if (!target) continue;
      if (sources[i]) map[sources[i].id] = { targetMatchupId: target.id, slot: 1 };
      if (sources[i + 1]) map[sources[i + 1].id] = { targetMatchupId: target.id, slot: 2 };
    }
  }

  // First Four -> Round of 64
  const ff = bracket.firstFour;
  // West 11 seed slot (11-seed is in team2 of 6-vs-11 matchup)
  const westR64 = bracket.roundOf64.filter(m => m.region === 'West');
  const west11Matchup = westR64.find(m => m.team1?.id === 'texas' || m.team2?.id === 'texas' || m.team1?.seed === 11 || m.team2?.seed === 11);
  if (ff[0] && west11Matchup) {
    map[ff[0].id] = { targetMatchupId: west11Matchup.id, slot: 2 };
  }

  // Midwest 11 seed slot (11-seed is in team2 of 6-vs-11 matchup)
  const midwestR64 = bracket.roundOf64.filter(m => m.region === 'Midwest');
  const midwest11Matchup = midwestR64.find(m => m.team1?.seed === 11 || m.team2?.seed === 11);
  if (ff[1] && midwest11Matchup) {
    map[ff[1].id] = { targetMatchupId: midwest11Matchup.id, slot: 2 };
  }

  // Midwest 16 seed slot
  const midwest16Matchup = midwestR64.find(m => m.team1?.seed === 16 || m.team2?.seed === 16);
  if (ff[2] && midwest16Matchup) {
    map[ff[2].id] = { targetMatchupId: midwest16Matchup.id, slot: 2 };
  }

  // South 16 seed slot
  const southR64 = bracket.roundOf64.filter(m => m.region === 'South');
  const south16Matchup = southR64.find(m => m.team1?.seed === 16 || m.team2?.seed === 16);
  if (ff[3] && south16Matchup) {
    map[ff[3].id] = { targetMatchupId: south16Matchup.id, slot: 2 };
  }

  // Round of 64 -> Round of 32 (by region)
  const regions: Region[] = ['East', 'West', 'Midwest', 'South'];
  for (const region of regions) {
    const r64 = bracket.roundOf64.filter(m => m.region === region);
    const r32 = bracket.roundOf32.filter(m => m.region === region);
    link(r64, r32);
  }

  // Round of 32 -> Sweet 16
  for (const region of regions) {
    const r32 = bracket.roundOf32.filter(m => m.region === region);
    const s16 = bracket.sweet16.filter(m => m.region === region);
    link(r32, s16);
  }

  // Sweet 16 -> Elite Eight
  for (const region of regions) {
    const s16 = bracket.sweet16.filter(m => m.region === region);
    const ee = bracket.eliteEight.filter(m => m.region === region);
    link(s16, ee);
  }

  // Elite Eight -> Final Four
  // East vs South -> FF game 1, West vs Midwest -> FF game 2
  const eastEE = bracket.eliteEight.filter(m => m.region === 'East')[0];
  const southEE = bracket.eliteEight.filter(m => m.region === 'South')[0];
  const westEE = bracket.eliteEight.filter(m => m.region === 'West')[0];
  const midwestEE = bracket.eliteEight.filter(m => m.region === 'Midwest')[0];
  const ff1 = bracket.finalFour[0];
  const ff2 = bracket.finalFour[1];

  if (eastEE && ff1) map[eastEE.id] = { targetMatchupId: ff1.id, slot: 1 };
  if (southEE && ff1) map[southEE.id] = { targetMatchupId: ff1.id, slot: 2 };
  if (westEE && ff2) map[westEE.id] = { targetMatchupId: ff2.id, slot: 1 };
  if (midwestEE && ff2) map[midwestEE.id] = { targetMatchupId: ff2.id, slot: 2 };

  // Final Four -> Championship
  const championship = bracket.championship;
  if (ff1 && championship) map[ff1.id] = { targetMatchupId: championship.id, slot: 1 };
  if (ff2 && championship) map[ff2.id] = { targetMatchupId: championship.id, slot: 2 };

  return map;
}
