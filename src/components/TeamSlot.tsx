'use client';

import { Team } from '@/types';

interface TeamSlotProps {
  team: Team | null;
  isWinner?: boolean;
  isLoser?: boolean;
  isUpset?: boolean;
  size?: 'sm' | 'md';
}

export default function TeamSlot({ team, isWinner, isLoser, isUpset, size = 'sm' }: TeamSlotProps) {
  if (!team) {
    return (
      <div className={`flex items-center gap-1.5 ${size === 'sm' ? 'py-1 px-2' : 'py-1.5 px-3'} rounded bg-gray-800/50 border border-gray-700/50`}>
        <span className={`${size === 'sm' ? 'w-4 text-xs' : 'w-5 text-sm'} text-gray-600 font-mono text-right flex-shrink-0`}>—</span>
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-600 truncate`}>TBD</span>
      </div>
    );
  }

  const seedColor = team.seed <= 4
    ? 'text-yellow-400'
    : team.seed <= 8
    ? 'text-blue-400'
    : team.seed <= 12
    ? 'text-green-400'
    : 'text-gray-400';

  return (
    <div className={`
      flex items-center gap-1.5 rounded border transition-all duration-300
      ${size === 'sm' ? 'py-1 px-2' : 'py-1.5 px-3'}
      ${isWinner
        ? 'bg-emerald-900/40 border-emerald-500/60 shadow-emerald-500/20 shadow-sm'
        : isLoser
        ? 'bg-gray-900/30 border-gray-700/30 opacity-50'
        : 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600/70'
      }
    `}>
      <span className={`${size === 'sm' ? 'w-4 text-xs' : 'w-5 text-sm'} ${seedColor} font-bold font-mono text-right flex-shrink-0`}>
        {team.seed}
      </span>
      <span className={`
        ${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium truncate flex-1
        ${isWinner ? 'text-white' : isLoser ? 'text-gray-500' : 'text-gray-200'}
      `}>
        {team.name}
      </span>
      {isUpset && isWinner && (
        <span className="text-xs text-amber-400 font-bold flex-shrink-0">UPSET</span>
      )}
      {isWinner && !isUpset && (
        <span className="text-emerald-400 text-xs flex-shrink-0">✓</span>
      )}
    </div>
  );
}
