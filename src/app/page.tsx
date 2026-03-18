'use client';

import { useState, useRef, useCallback } from 'react';
import { BracketState, SimulationEvent, Matchup, Team, RoundName } from '@/types';
import { updateBracketAfterGame } from '@/lib/bracket';
import { isUpset } from '@/lib/probability';
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
  const [provider, setProvider] = useState<string>('');
  const stopRef = useRef(false);
  const bracketRef = useRef<BracketState | null>(null);

  const pushEvent = useCallback((event: SimulationEvent) => {
    setEvents(prev => [...prev, event]);
  }, []);

  async function simulateOneGame(
    matchup: Matchup,
    upsetCount: number,
    totalGames: number,
  ): Promise<{ winner: Team; loser: Team; reasoning: string; matchupIsUpset: boolean } | null> {
    if (!matchup.team1 || !matchup.team2) return null;

    const res = await fetch('/api/simulate-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1: matchup.team1,
        team2: matchup.team2,
        round: matchup.round,
        venue: matchup.venue ?? 'TBD',
        upsetCount,
        totalGames,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const result = await res.json() as { winner: string; reasoning: string; error?: string };
    if (result.error) throw new Error(result.error);

    const winnerName = result.winner.toLowerCase();
    const winner =
      winnerName.includes(matchup.team1.name.toLowerCase()) ||
      matchup.team1.name.toLowerCase().includes(winnerName)
        ? matchup.team1
        : matchup.team2;
    const loser = winner.id === matchup.team1.id ? matchup.team2 : matchup.team1;
    const matchupIsUpset = isUpset(winner, loser);

    return { winner, loser, reasoning: result.reasoning, matchupIsUpset };
  }

  const startSimulation = useCallback(async () => {
    if (isRunning) return;
    stopRef.current = false;

    setEvents([]);
    setIsRunning(true);
    setIsComplete(false);
    setActiveMatchupId(undefined);
    setSelectedGame(null);
    setErrorMessage(null);

    try {
      // Fetch initial bracket and provider info
      const initRes = await fetch('/api/init-bracket');
      const { bracket: initialBracket, provider: detectedProvider } = await initRes.json() as {
        bracket: BracketState;
        provider: string | null;
      };

      if (!detectedProvider) {
        setErrorMessage(
          'No API key found. Add GROQ_API_KEY (free, console.groq.com) or GEMINI_API_KEY or ANTHROPIC_API_KEY to your environment variables.',
        );
        setIsRunning(false);
        return;
      }

      setProvider(detectedProvider);
      setBracketState(initialBracket);
      bracketRef.current = initialBracket;

      let upsetCount = 0;
      let totalGames = 0;

      pushEvent({
        type: 'status',
        message: `Starting simulation with ${
          detectedProvider === 'groq' ? 'Groq Llama 3.3 70B (free)'
          : detectedProvider === 'gemini' ? 'Google Gemini Flash Lite (free)'
          : 'Anthropic Claude Haiku'
        }...`,
      });

      // Rounds in order
      const roundSequence: Array<{ key: keyof BracketState; name: RoundName }> = [
        { key: 'firstFour', name: 'First Four' },
        { key: 'roundOf64', name: 'Round of 64' },
        { key: 'roundOf32', name: 'Round of 32' },
        { key: 'sweet16', name: 'Sweet 16' },
        { key: 'eliteEight', name: 'Elite Eight' },
        { key: 'finalFour', name: 'Final Four' },
        { key: 'championship', name: 'Championship' },
      ];

      for (const { key, name } of roundSequence) {
        if (stopRef.current) break;
        setActiveRound(name);
        pushEvent({ type: 'status', message: `Simulating ${name}...`, round: name });

        const current = bracketRef.current!;
        const rawMatchups = key === 'championship'
          ? [current.championship]
          : (current[key] as Matchup[]);

        for (const matchup of rawMatchups) {
          if (stopRef.current) break;

          // Get fresh version from current bracket
          const fresh = key === 'championship'
            ? bracketRef.current!.championship
            : (bracketRef.current![key] as Matchup[]).find(m => m.id === matchup.id);

          if (!fresh?.team1 || !fresh?.team2) continue;

          setActiveMatchupId(fresh.id);

          try {
            const result = await simulateOneGame(fresh, upsetCount, totalGames);
            if (!result) continue;

            const { winner, loser, reasoning, matchupIsUpset } = result;

            // Update bracket
            const updatedBracket = updateBracketAfterGame(bracketRef.current!, fresh.id, winner);
            if (key === 'championship') updatedBracket.champion = winner;
            bracketRef.current = updatedBracket;
            setBracketState({ ...updatedBracket });

            totalGames++;
            if (matchupIsUpset) upsetCount++;

            pushEvent({
              type: 'game_result',
              matchupId: fresh.id,
              winner,
              loser,
              reasoning,
              isUpset: matchupIsUpset,
              round: name,
              upsetCount,
              totalGames,
              bracketState: updatedBracket,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            pushEvent({ type: 'error', message: `${fresh.team1.name} vs ${fresh.team2.name}: ${msg}` });
            // If it's a quota/auth error, stop entirely
            if (msg.includes('quota') || msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
              setErrorMessage(msg);
              stopRef.current = true;
              break;
            }
          }
        }

        if (!stopRef.current) {
          pushEvent({ type: 'round_complete', round: name, upsetCount, totalGames });
        }
      }

      if (!stopRef.current) {
        const champion = bracketRef.current?.champion;
        pushEvent({
          type: 'simulation_complete',
          upsetCount,
          totalGames,
          bracketState: bracketRef.current ?? undefined,
          message: `${champion?.name ?? 'Unknown'} wins the 2026 NCAA Tournament! ${upsetCount} upsets across ${totalGames} games.`,
        });
        setIsComplete(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
      setActiveMatchupId(undefined);
    }
  }, [isRunning, pushEvent]);

  const stopSimulation = useCallback(() => {
    stopRef.current = true;
    setIsRunning(false);
  }, []);

  const getMatchupsWithReasoning = (matchups: Matchup[]): Matchup[] => {
    return matchups.map(m => {
      const event = events.find(e => e.matchupId === m.id && e.type === 'game_result');
      if (event) return { ...m, reasoning: event.reasoning, isUpset: event.isUpset };
      return m;
    });
  };

  const bracket = bracketState;
  const r64 = bracket ? getMatchupsWithReasoning(bracket.roundOf64) : [];
  const r32 = bracket ? getMatchupsWithReasoning(bracket.roundOf32) : [];
  const s16 = bracket ? getMatchupsWithReasoning(bracket.sweet16) : [];
  const ee = bracket ? getMatchupsWithReasoning(bracket.eliteEight) : [];
  const ff = bracket ? getMatchupsWithReasoning(bracket.finalFour) : [];
  const champ = bracket ? getMatchupsWithReasoning([bracket.championship])[0] : null;

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
            {provider && isRunning && (
              <span className="text-xs text-gray-500">{provider === 'groq' ? 'Groq Llama 3.3' : provider === 'gemini' ? 'Gemini Flash Lite' : 'Claude Haiku'}</span>
            )}
            {activeRound && isRunning && (
              <span className="text-xs text-blue-400 animate-pulse">{activeRound}</span>
            )}
            {isComplete && bracket?.champion && (
              <span className="text-xs text-yellow-400 font-semibold">
                🏆 {bracket.champion.name}
              </span>
            )}
            {!isRunning && !isComplete && (
              <button onClick={startSimulation} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-colors">
                Simulate Bracket
              </button>
            )}
            {isRunning && (
              <button onClick={stopSimulation} className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors">
                Stop
              </button>
            )}
            {isComplete && (
              <button onClick={startSimulation} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition-colors">
                Simulate Again
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-2 py-4">
        {!bracket ? (
          /* Landing */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-white mb-3">2026 NCAA Tournament Simulation</h2>
            <p className="text-gray-400 max-w-2xl mb-6 leading-relaxed">
              Watch the entire NCAA Tournament bracket unfold in real-time, powered by AI.
              Each game is analyzed with KenPom statistics, historical upset rates, and tournament-specific
              factors to produce a realistic simulation with genuine Cinderella stories.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 w-full max-w-2xl">
              {[
                { label: '1 Seeds', desc: 'Duke · Arizona · Michigan · Florida', color: 'text-yellow-400' },
                { label: '68 Teams', desc: 'Full field including First Four', color: 'text-blue-400' },
                { label: 'Groq / Claude', desc: 'Free or paid AI provider', color: 'text-purple-400' },
                { label: 'Live Results', desc: 'Game-by-game with reasoning', color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
                  <div className={`text-sm font-bold ${item.color}`}>{item.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* Provider setup */}
            <div className="w-full max-w-2xl mb-6 rounded-xl border border-gray-700/60 overflow-hidden">
              <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-700/60">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Setup — Pick an AI provider</span>
              </div>
              <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-700/60">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40">Free ★ Best</span>
                  </div>
                  <div className="text-sm font-semibold text-white mb-2">Groq</div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">No credit card. Fast. Full sim in ~2 min.</p>
                  <ol className="text-xs text-gray-400 space-y-1.5">
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">1.</span><span><a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">console.groq.com</a> → sign up free</span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">2.</span><span>Create API Key</span></li>
                    <li className="flex gap-2"><span className="text-gray-600 flex-shrink-0">3.</span><span>Set env var <code className="text-gray-300 bg-gray-800 px-1 rounded">GROQ_API_KEY</code></span></li>
                  </ol>
                </div>
                <div className="p-4 opacity-75">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide bg-yellow-900/20 px-2 py-0.5 rounded-full border border-yellow-700/40">Free (limited)</span>
                  </div>
                  <div className="text-sm font-semibold text-white mb-2">Google Gemini</div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">~20 req/day free tier.</p>
                  <div className="text-xs text-gray-400">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">aistudio.google.com/app/apikey</a>
                    <div className="mt-2">Set <code className="text-gray-300 bg-gray-800 px-1 rounded">GEMINI_API_KEY</code></div>
                  </div>
                </div>
                <div className="p-4 opacity-75">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-700/40">Paid ~$0.03</span>
                  </div>
                  <div className="text-sm font-semibold text-white mb-2">Anthropic Claude</div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">Claude Haiku, ~$0.03 per full sim.</p>
                  <div className="text-xs text-gray-400">
                    <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">console.anthropic.com</a>
                    <div className="mt-2">Set <code className="text-gray-300 bg-gray-800 px-1 rounded">ANTHROPIC_API_KEY</code></div>
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

            {/* Info bar */}
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span className="text-gray-300 font-medium">2026 NCAA Tournament</span>
              <span>·</span>
              <span>First Four: Dayton, OH</span>
              <span>·</span>
              <span>Final Four & Championship: Indianapolis, IN</span>
              {isRunning && (
                <>
                  <span>·</span>
                  <span className="text-blue-400 animate-pulse">● {activeRound}</span>
                </>
              )}
            </div>

            {/* First Four */}
            {bracket.firstFour.some(m => m.team1 || m.team2) && (
              <div className="bg-gray-900/40 rounded-xl border border-gray-700/40 p-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">First Four — Dayton, OH</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {getMatchupsWithReasoning(bracket.firstFour).map(matchup => (
                    <div key={matchup.id} className="cursor-pointer" onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}>
                      <GameCard matchup={matchup} isActive={matchup.id === activeMatchupId} showReasoning={selectedGame?.id === matchup.id} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main bracket */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px_1fr] gap-3">
              {/* Left: East & South */}
              <div className="space-y-3">
                {(['East', 'South'] as const).map(region => {
                  const regionColors = { East: 'text-blue-400', South: 'text-orange-400' };
                  return (
                    <div key={region} className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-3">
                      <h3 className={`text-sm font-bold ${regionColors[region]} mb-2`}>{region} Region</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { matchups: r64.filter(m => m.region === region), label: 'R64' },
                          { matchups: r32.filter(m => m.region === region), label: 'R32' },
                          { matchups: s16.filter(m => m.region === region), label: 'S16' },
                          { matchups: ee.filter(m => m.region === region), label: 'E8' },
                        ].map(({ matchups, label }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600 text-center">{label}</span>
                            <div className="flex flex-col gap-1">
                              {matchups.map(matchup => (
                                <div key={matchup.id} className="cursor-pointer" onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}>
                                  <GameCard matchup={matchup} isActive={matchup.id === activeMatchupId} showReasoning={selectedGame?.id === matchup.id} size="sm" />
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

              {/* Center: Final Four + Championship */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-full">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-2">Final Four</h3>
                  <div className="space-y-2">
                    {ff.map(matchup => (
                      <div key={matchup.id} className="cursor-pointer" onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}>
                        <GameCard matchup={matchup} isActive={matchup.id === activeMatchupId} showReasoning={selectedGame?.id === matchup.id} size="md" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full">
                  <h3 className="text-xs font-semibold text-yellow-600 uppercase tracking-wide text-center mb-2">Championship</h3>
                  {champ && (
                    <div className="cursor-pointer" onClick={() => setSelectedGame(selectedGame?.id === champ.id ? null : champ)}>
                      <div className={`rounded-xl border-2 p-1 ${champ.winner ? 'border-yellow-500/60 bg-yellow-900/10' : 'border-gray-600/50'}`}>
                        <GameCard matchup={champ} isActive={champ.id === activeMatchupId} showReasoning={selectedGame?.id === champ.id} size="md" />
                      </div>
                    </div>
                  )}
                  {bracket.champion && (
                    <div className="mt-3 text-center p-3 bg-yellow-900/20 rounded-lg border border-yellow-700/40">
                      <div className="text-2xl mb-1">🏆</div>
                      <div className="text-sm font-bold text-yellow-300">{bracket.champion.name}</div>
                      <div className="text-xs text-yellow-600">{bracket.champion.seed}-seed Champion</div>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-600">Lucas Oil Stadium</p>
                  <p className="text-xs text-gray-700">Indianapolis, IN</p>
                </div>
              </div>

              {/* Right: West & Midwest */}
              <div className="space-y-3">
                {(['West', 'Midwest'] as const).map(region => {
                  const regionColors = { West: 'text-emerald-400', Midwest: 'text-purple-400' };
                  return (
                    <div key={region} className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-3">
                      <h3 className={`text-sm font-bold ${regionColors[region]} mb-2`}>{region} Region</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { matchups: ee.filter(m => m.region === region), label: 'E8' },
                          { matchups: s16.filter(m => m.region === region), label: 'S16' },
                          { matchups: r32.filter(m => m.region === region), label: 'R32' },
                          { matchups: r64.filter(m => m.region === region), label: 'R64' },
                        ].map(({ matchups, label }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600 text-center">{label}</span>
                            <div className="flex flex-col gap-1">
                              {matchups.map(matchup => (
                                <div key={matchup.id} className="cursor-pointer" onClick={() => setSelectedGame(selectedGame?.id === matchup.id ? null : matchup)}>
                                  <GameCard matchup={matchup} isActive={matchup.id === activeMatchupId} showReasoning={selectedGame?.id === matchup.id} size="sm" />
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

            {/* Bottom */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-2">
              <LiveFeed events={events} isRunning={isRunning} />
              <SimulationStats events={events} bracketState={bracket} isComplete={isComplete} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
