'use client';

import { SimulationEvent } from '@/types';

interface LiveFeedProps {
  events: SimulationEvent[];
  isRunning: boolean;
}

export default function LiveFeed({ events, isRunning }: LiveFeedProps) {
  const gameResults = events.filter(e => e.type === 'game_result');
  const latestEvents = [...gameResults].reverse().slice(0, 20);

  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
        <h3 className="text-sm font-semibold text-gray-300">Live Results</h3>
        {isRunning && <span className="text-xs text-gray-500 ml-auto">Simulating...</span>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {latestEvents.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-4">
            {isRunning ? 'Waiting for results...' : 'Press Simulate to start'}
          </p>
        )}
        {latestEvents.map((event, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-2.5 border text-xs transition-all ${
              event.isUpset
                ? 'bg-amber-900/20 border-amber-600/40'
                : 'bg-gray-800/40 border-gray-700/40'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`font-bold flex-shrink-0 mt-0.5 ${event.isUpset ? 'text-amber-400' : 'text-emerald-400'}`}>
                {event.isUpset ? '⚡' : '✓'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold text-white">{event.winner?.name}</span>
                  <span className="text-gray-500">def.</span>
                  <span className="text-gray-400">{event.loser?.name}</span>
                  {event.isUpset && (
                    <span className="text-amber-400 font-bold text-xs ml-1">UPSET!</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-gray-600">{event.round}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-600">
                    {event.winner?.seed}-seed over {event.loser?.seed}-seed
                  </span>
                </div>
                {event.reasoning && (
                  <p className="text-gray-400 mt-1 leading-relaxed">{event.reasoning}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
