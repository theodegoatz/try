import { NextRequest, NextResponse } from 'next/server';
import { simulateGame, getProvider } from '@/lib/simulation';
import { Team, RoundName } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const provider = getProvider();

  if (!provider) {
    return NextResponse.json(
      {
        error: [
          'No AI provider configured.',
          'Option 1 — FREE: Get a Groq key at https://console.groq.com — add GROQ_API_KEY to environment variables',
          'Option 2 — FREE (limited): Get a Gemini key at https://aistudio.google.com/app/apikey — add GEMINI_API_KEY',
          'Option 3 — Paid: Get an Anthropic key at https://console.anthropic.com — add ANTHROPIC_API_KEY',
        ].join(' '),
      },
      { status: 400 },
    );
  }

  try {
    const body = await request.json() as {
      team1: Team;
      team2: Team;
      round: RoundName;
      venue: string;
      upsetCount: number;
      totalGames: number;
    };

    const { team1, team2, round, venue, upsetCount, totalGames } = body;

    if (!team1 || !team2) {
      return NextResponse.json({ error: 'Missing team1 or team2' }, { status: 400 });
    }

    const result = await simulateGame(team1, team2, round, venue ?? 'TBD', upsetCount ?? 0, totalGames ?? 0);

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
