'use client';

import { useState, useRef, useCallback } from 'react';
import { BracketState, SimulationEvent, Matchup } from '@/types';
import { initializeBracket } from '@/lib/bracket';
import GameCard from '@/components/GameCard';
import LiveFeed from '@/components/LiveFeed';
import SimulationStats from '@/components/SimulationStats';

export default function Home() {
  const [bracketState, setBracketState] = useState<BracketState | null>(null);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeMatchupId, setActiveMatchupId] = useState<string | undefined>();
  const [activeRound, setActiveRound] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<Matchup | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startSimulation = useCallback(async () => {
    if (isRunning) return;

    // Initialize bracket
    const initial = initializeBracket();
    setBracketState(initial);
    setEvents([]);
    setIsRunning(true);
    setIsComplete(false);
    setActiveMatchupId(undefined);
    setSelectedGame(null);
    setErrorMessage(null);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/simulate', {
        signal: abortRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SimulationEvent = JSON.parse(line.slice(6));
              setEvents(prev => [...prev, event]);

              if (event.bracketState) {
                setBracketState(event.bracketState);
              }

              if (event.matchupId) {
                setActiveMatchupId(event.matchupId);
              }

              if (event.round) {
                setActiveRound(event.round);
              }

              if (event.type === 'game_result' && event.bracketState) {
                // Update the selected game reasoning if it's the active one
                const allMatchups = [
                  ...event.bracketState.firstFour,
                  ...event.bracketState.roundOf64,
                  ...event.bracketState.roundOf32,
                  ...event.bracketState.sweet16,
                  ...event.bracketState.eliteEight,
                  ...event.bracketState.finalFour,
                  event.bracketState.championship,
                ];
                const completedGame = allMatchups.find(m => m.id === event.matchupId);
                if (completedGame) {
                  (completedGame as Matchup).reasoning = event.reasoning;
                  (completedGame as Matchup).isUpset = event.isUpset;
                }
              }

              if (event.type === 'simulation_complete') {
                setIsComplete(true);
                setIsRunning(false);
                setActiveMatchupId(undefined);
              }

              if (event.type === 'error') {
                console.error('Simulation error:', event.message);
                setErrorMessage(event.message || 'An error occurred');
                setIsRunning(false);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Simulation failed:', error);
      }
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  const stopSimulation = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const getMatchupsWithReasoning = (matchups: Matchup[], eventsData: SimulationEvent[]): Matchup[] => {
    return matchups.map(m => {
      const event = eventsData.find(e => e.matchupId === m.id && e.type === 'game_result');
      if (event) {
        return { ...m, reasoning: event.reasoning, isUpset: event.isUpset };
      }
      return m;
    });
  };

  const bracket = bracketState;
  const currentEvents = events;

  const r64WithReasoning = bracket ? getMatchupsWithReasoning(bracket.roundOf64, currentEvents) : [];
  const r32WithReasoning = bracket ? getMatchupsWithReasoning(bracket.roundOf32, currentEvents) : [];
  const s16WithReasoning = bracket ? getMatchupsWithReasoning(bracket.sweet16, currentEvents) : [];
  const eeWithReasoning = bracket ? getMatchupsWithReasoning(bracket.eliteEight, currentEvents) : [];
  const ffWithReasoning = bracket ? getMatchupsWithReasoning(bracket.finalFour, currentEvents) : [];
  const champWithReasoning = bracket
    ? getMatchupsWithReasoning([bracket.championship], currentEvents)[0]
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/80 bg-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏀</div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">March Madness Arena</h1>
              <p className="text-xs text-gray-500">2026 NCAA Tournament · AI-Powered Simulation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeRound && isRunning && (
              <span className="text-xs text-blue-400 animate-pulse">{activeRound}</span>
            )}
            {isComplete && bracket?.champion && (
              <span className="text-xs text-yellow-400 font-semibold">
                Champion: {bracket.champion.name}
              </span>
            )}

            {!isRunning && !isComplete && (
              <button
                onClick={startSimulation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                Simulate Bracket
              </button>
            )}
            {isRunning && (
              <button
                onClick={stopSimulation}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                Stop
              </button>
            )}
            {isComplete && (
              <button
                onClick={startSimulation}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                Simulate Again
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-[1800px] mx-auto px-2 py-4">
        {!bracket ? (
          /* Landing state */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-white mb-3">2026 NCAA Tournament Simulation</h2>
            <p className="text-gray-400 max-w-2xl mb-6 leading-relaxed">
              Watch the entire NCAA Tournament bracket unfold in real-time, powered by Claude AI.
              Each game is analyzed with KenPom statistics, historical upset rates, and tournament-specific
              factors to produce a realistic simulation with genuine Cinderella stories.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 w-full max-w-2xl">
              {[
                { label: '1 Seeds', desc: 'Duke · Arizona · Michigan · Florida', color: 'text-yellow-400' },
                { label: '68 Teams', desc: 'Full field including First Four', color: 'text-blue-400' },
                { label: 'Gemini / Claude', desc: 'Free or paid AI provider', color: 'text-purple-400' },
                { label: 'Live Stream', desc: 'Game-by-game results', color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
                  <div className={`text-sm font-bold ${item.color}`}>{item.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* API key setup instructions */}
            <div className="w-full max-w-2xl mb-6 rounded-xl border border-gray-700/60 overflow-hidden">
              <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-700/60">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Setup — Pick an AI provider</span>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700/60">
                {/* Free option */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40">Free</span>
                    <span className="text-sm font-semibold text-white">Google Gemini</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    Get a free API key — no billing required. 1,500 requests/day, plenty for a full 67-game simulation.
                  </p>
                  <ol className="text-xs text-gray-400 space-y-1.5">
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">1.</span><span>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">aistudio.google.com/app/apikey</a></span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">2.</span><span>Click <span className="text-white">Create API key</span> (free, no credit card)</span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">3.</span><span>Add to <code className="text-gray-300 bg-gray-800 px-1 rounded">.env.local</code>:</span></li>
                  </ol>
                  <div className="mt-2 bg-gray-900 rounded-lg p-2 border border-gray-700/50">
                    <code className="text-xs text-emerald-300">GEMINI_API_KEY=your_key_here</code>
                  </div>
                </div>

                {/* Paid option */}
                <div className="p-4 opacity-80">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-700/40">Paid</span>
                    <span className="text-sm font-semibold text-white">Anthropic Claude</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    Uses claude-haiku-4-5. Full 67-game simulation costs ~$0.03.
                  </p>
                  <ol className="text-xs text-gray-400 space-y-1.5">
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">1.</span><span>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">console.anthropic.com</a></span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">2.</span><span>Create an account and add billing</span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">3.</span><span>Add to <code className="text-gray-300 bg-gray-800 px-1 rounded">.env.local</code>:</span></li>
                  </ol>
                  <div className="mt-2 bg-gray-900 rounded-lg p-2 border border-gray-700/50">
                    <code className="text-xs text-blue-300">ANTHROPIC_API_KEY=your_key_here</code>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="w-full max-w-2xl mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-red-300 leading-relaxed">
                {errorMessage}
              </div>
            )}

            <button
              onClick={startSimulation}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-xl transition-colors shadow-lg shadow-blue-900/30"
            >
              Start Simulation
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errorMessage && (
              <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-red-300 leading-relaxed">
                <span className="font-semibold text-red-400">Error: </span>{errorMessage}
              </div>
            )}

            {/* Top info bar */}
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span className="text-gray-300 font-medium">2026 NCAA Tournament</span>
              <span>·</span>
              <span>First Four: Dayton, OH · Mar 17-18</span>
              <span>·</span>
              <span>First Round: Mar 19-20</span>
              <span>·</span>
              <span>Final Four & Championship: Indianapolis, IN</span>
              {isRunning && (
                <>
                  <span>·</span>
                  <span className="text-blue-400 animate-pulse">● Simulating {activeRound}</span>
                </>
              )}
            </div>

            {/* First Four */}
            {bracket.firstFour.some(m => m.team1 || m.team2) && (
              <div className="bg-gray-900/40 rounded-xl border border-gray-700/40 p-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  First Four — Dayton, OH
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {getMatchupsWithReasoning(bracket.firstFour, currentEvents).map(matchup => (
                    <div
                      key={matchup.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}
                    >
                      <GameCard
                        matchup={matchup}
                        isActive={matchup.id === activeMatchupId}
                        showReasoning={selectedGame?.id === matchup.id}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main bracket */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px_1fr] gap-3">
              {/* Left side: East & South */}
              <div className="space-y-3">
                {(['East', 'South'] as const).map(region => {
                  const regionR64 = r64WithReasoning.filter(m => m.region === region);
                  const regionR32 = r32WithReasoning.filter(m => m.region === region);
                  const regionS16 = s16WithReasoning.filter(m => m.region === region);
                  const regionEE = eeWithReasoning.filter(m => m.region === region);

                  const regionColors = {
                    East: 'text-blue-400 border-blue-800/40',
                    South: 'text-orange-400 border-orange-800/40',
                  };

                  return (
                    <div key={region} className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-3">
                      <h3 className={`text-sm font-bold ${regionColors[region].split(' ')[0]} mb-2`}>
                        {region} Region
                      </h3>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { matchups: regionR64, label: 'R64' },
                          { matchups: regionR32, label: 'R32' },
                          { matchups: regionS16, label: 'S16' },
                          { matchups: regionEE, label: 'E8' },
                        ].map(({ matchups, label }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600 text-center">{label}</span>
                            <div className="flex flex-col gap-1">
                              {matchups.map(matchup => (
                                <div
                                  key={matchup.id}
                                  className="cursor-pointer"
                                  onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}
                                >
                                  <GameCard
                                    matchup={matchup}
                                    isActive={matchup.id === activeMatchupId}
                                    showReasoning={selectedGame?.id === matchup.id}
                                    size="sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Center: Final Four & Championship */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-full">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-2">
                    Final Four
                  </h3>
                  <div className="space-y-2">
                    {ffWithReasoning.map(matchup => (
                      <div
                        key={matchup.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}
                      >
                        <GameCard
                          matchup={matchup}
                          isActive={matchup.id === activeMatchupId}
                          showReasoning={selectedGame?.id === matchup.id}
                          size="md"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Championship */}
                <div className="w-full">
                  <h3 className="text-xs font-semibold text-yellow-600 uppercase tracking-wide text-center mb-2">
                    Championship
                  </h3>
                  {champWithReasoning && (
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedGame(selectedGame?.id === champWithReasoning.id ? null : champWithReasoning)}
                    >
                      <div className={`rounded-xl border-2 p-1 ${champWithReasoning.winner ? 'border-yellow-500/60 bg-yellow-900/10' : 'border-gray-600/50'}`}>
                        <GameCard
                          matchup={champWithReasoning}
                          isActive={champWithReasoning.id === activeMatchupId}
                          showReasoning={selectedGame?.id === champWithReasoning.id}
                          size="md"
                        />
                      </div>
                    </div>
                  )}

                  {/* Champion trophy */}
                  {bracket.champion && (
                    <div className="mt-3 text-center p-3 bg-yellow-900/20 rounded-lg border border-yellow-700/40">
                      <div className="text-2xl mb-1">🏆</div>
                      <div className="text-sm font-bold text-yellow-300">{bracket.champion.name}</div>
                      <div className="text-xs text-yellow-600">{bracket.champion.seed}-seed Champion</div>
                    </div>
                  )}
                </div>

                {/* Indianapolis info */}
                <div className="text-center">
                  <p className="text-xs text-gray-600">Lucas Oil Stadium</p>
                  <p className="text-xs text-gray-700">Indianapolis, IN</p>
                </div>
              </div>

              {/* Right side: West & Midwest */}
              <div className="space-y-3">
                {(['West', 'Midwest'] as const).map(region => {
                  const regionR64 = r64WithReasoning.filter(m => m.region === region);
                  const regionR32 = r32WithReasoning.filter(m => m.region === region);
                  const regionS16 = s16WithReasoning.filter(m => m.region === region);
                  const regionEE = eeWithReasoning.filter(m => m.region === region);

                  const regionColors = {
                    West: 'text-emerald-400',
                    Midwest: 'text-purple-400',
                  };

                  return (
                    <div key={region} className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-3">
                      <h3 className={`text-sm font-bold ${regionColors[region]} mb-2`}>
                        {region} Region
                      </h3>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { matchups: regionEE, label: 'E8' },
                          { matchups: regionS16, label: 'S16' },
                          { matchups: regionR32, label: 'R32' },
                          { matchups: regionR64, label: 'R64' },
                        ].map(({ matchups, label }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600 text-center">{label}</span>
                            <div className="flex flex-col gap-1">
                              {matchups.map(matchup => (
                                <div
                                  key={matchup.id}
                                  className="cursor-pointer"
                                  onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}
                                >
                                  <GameCard
                                    matchup={matchup}
                                    isActive={matchup.id === activeMatchupId}
                                    showReasoning={selectedGame?.id === matchup.id}
                                    size="sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom panel: Live feed + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-2">
              <LiveFeed events={currentEvents} isRunning={isRunning} />
              <SimulationStats
                events={currentEvents}
                bracketState={bracket}
                isComplete={isComplete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
