'use client';

import { Matchup, Region } from '@/types';
import GameCard from './GameCard';

interface RegionBracketProps {
  region: Region;
  roundOf64: Matchup[];
  roundOf32: Matchup[];
  sweet16: Matchup[];
  eliteEight: Matchup[];
  activeMatchupId?: string;
  flip?: boolean; // flip left/right for right side of bracket
}

export default function RegionBracket({
  region,
  roundOf64,
  roundOf32,
  sweet16,
  eliteEight,
  activeMatchupId,
  flip = false,
}: RegionBracketProps) {
  const regionR64 = roundOf64.filter(m => m.region === region);
  const regionR32 = roundOf32.filter(m => m.region === region);
  const regionS16 = sweet16.filter(m => m.region === region);
  const regionEE = eliteEight.filter(m => m.region === region);

  const regionColors: Record<Region, string> = {
    East: 'text-blue-400',
    West: 'text-emerald-400',
    South: 'text-orange-400',
    Midwest: 'text-purple-400',
  };

  const rounds = flip
    ? [
        { matchups: regionEE, label: 'Elite 8' },
        { matchups: regionS16, label: 'Sweet 16' },
        { matchups: regionR32, label: 'Round of 32' },
        { matchups: regionR64, label: 'Round of 64' },
      ]
    : [
        { matchups: regionR64, label: 'Round of 64' },
        { matchups: regionR32, label: 'Round of 32' },
        { matchups: regionS16, label: 'Sweet 16' },
        { matchups: regionEE, label: 'Elite 8' },
      ];

  return (
    <div className="flex flex-col gap-1">
      <h3 className={`text-sm font-bold ${regionColors[region]} text-center mb-1`}>{region}</h3>
      <div className={`flex ${flip ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        {rounds.map(({ matchups, label }, roundIdx) => (
          <div key={label} className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-xs text-gray-500 text-center truncate">{label}</span>
            <div
              className="flex flex-col justify-around"
              style={{
                minHeight: `${roundIdx === 0 ? 8 * 50 : roundIdx === 1 ? 4 * 100 : roundIdx === 2 ? 2 * 200 : 400}px`,
              }}
            >
              {matchups.map(matchup => (
                <div key={matchup.id} className="flex items-center justify-center">
                  <div className="w-full">
                    <GameCard
                      matchup={matchup}
                      isActive={matchup.id === activeMatchupId}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
