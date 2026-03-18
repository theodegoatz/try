'use client';

import { Matchup } from '@/types';
import TeamSlot from './TeamSlot';

interface GameCardProps {
  matchup: Matchup;
  isActive?: boolean;
  showReasoning?: boolean;
  size?: 'sm' | 'md';
}

export default function GameCard({ matchup, isActive, showReasoning, size = 'sm' }: GameCardProps) {
  const team1 = matchup.team1;
  const team2 = matchup.team2;
  const winner = matchup.winner;

  const team1IsWinner = winner?.id === team1?.id;
  const team2IsWinner = winner?.id === team2?.id;

  return (
    <div className={`
      rounded-lg border transition-all duration-300
      ${isActive
        ? 'border-blue-500/70 shadow-blue-500/20 shadow-md bg-gray-900/80 animate-pulse-border'
        : winner
        ? 'border-gray-600/50 bg-gray-900/60'
        : 'border-gray-700/50 bg-gray-900/40'
      }
      ${size === 'sm' ? 'p-1' : 'p-2'}
    `}>
      <div className="flex flex-col gap-0.5">
        <TeamSlot
          team={team1}
          isWinner={team1IsWinner && !!winner}
          isLoser={team2IsWinner && !!winner}
          isUpset={matchup.isUpset && team1IsWinner}
          size={size}
        />
        <div className={`${size === 'sm' ? 'h-px' : 'h-px'} bg-gray-700/50 mx-1`} />
        <TeamSlot
          team={team2}
          isWinner={team2IsWinner && !!winner}
          isLoser={team1IsWinner && !!winner}
          isUpset={matchup.isUpset && team2IsWinner}
          size={size}
        />
      </div>

      {showReasoning && matchup.reasoning && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
          <p className="text-xs text-gray-400 leading-relaxed">{matchup.reasoning}</p>
        </div>
      )}
    </div>
  );
}
