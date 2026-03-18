'use client';

import { SimulationEvent, BracketState } from '@/types';

interface SimulationStatsProps {
  events: SimulationEvent[];
  bracketState: BracketState | null;
  isComplete: boolean;
}

export default function SimulationStats({ events, bracketState, isComplete }: SimulationStatsProps) {
  const latestGameResult = [...events].reverse().find(e => e.type === 'game_result');
  const upsetCount = latestGameResult?.upsetCount ?? 0;
  const totalGames = latestGameResult?.totalGames ?? 0;
  const upsetRate = totalGames > 0 ? ((upsetCount / totalGames) * 100).toFixed(1) : '0.0';

  const upsets = events.filter(e => e.type === 'game_result' && e.isUpset);
  const biggestUpsets = upsets
    .filter(e => e.winner && e.loser && e.winner.seed - e.loser.seed >= 4)
    .slice(-5);

  const roundCounts: Record<string, number> = {};
  events.filter(e => e.type === 'game_result').forEach(e => {
    if (e.round) roundCounts[e.round] = (roundCounts[e.round] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-white">{totalGames}</div>
          <div className="text-xs text-gray-500 mt-0.5">Games Played</div>
        </div>
        <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-700/40 text-center">
          <div className="text-2xl font-bold text-amber-400">{upsetCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Upsets</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-blue-400">{upsetRate}%</div>
          <div className="text-xs text-gray-500 mt-0.5">Upset Rate</div>
        </div>
      </div>

      {/* Champion display */}
      {isComplete && bracketState?.champion && (
        <div className="bg-gradient-to-r from-yellow-900/30 via-amber-900/20 to-yellow-900/30 rounded-xl p-4 border border-yellow-600/50 text-center">
          <div className="text-xs text-yellow-500 uppercase tracking-widest mb-1">2026 NCAA Champion</div>
          <div className="text-2xl font-bold text-yellow-300">{bracketState.champion.name}</div>
          <div className="text-sm text-yellow-500/70 mt-1">
            {bracketState.champion.seed}-seed · {bracketState.champion.conference}
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            KenPom #{bracketState.champion.kenpom.rank} · AdjEM +{bracketState.champion.kenpom.adjEM.toFixed(1)}
          </div>
          <div className="mt-2 text-4xl">🏆</div>
        </div>
      )}

      {/* Notable upsets */}
      {biggestUpsets.length > 0 && (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notable Upsets</h4>
          <div className="space-y-1.5">
            {biggestUpsets.map((e, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 font-bold">⚡</span>
                <span className="text-amber-300 font-semibold">#{e.winner?.seed} {e.winner?.name}</span>
                <span className="text-gray-600">over</span>
                <span className="text-gray-400">#{e.loser?.seed} {e.loser?.name}</span>
                <span className="text-gray-600 ml-auto">{e.round}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Four */}
      {bracketState && bracketState.finalFour.some(m => m.team1 || m.team2) && (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Final Four</h4>
          <div className="grid grid-cols-2 gap-2">
            {bracketState.finalFour.map((m, idx) => (
              <div key={idx} className="space-y-1">
                {[m.team1, m.team2].map((team, tIdx) => team && (
                  <div key={tIdx} className={`text-xs px-2 py-1 rounded ${m.winner?.id === team.id ? 'bg-emerald-900/30 text-emerald-300' : 'text-gray-400'}`}>
                    <span className="text-gray-600 mr-1">#{team.seed}</span>
                    {team.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
