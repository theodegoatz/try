import { NextResponse } from 'next/server';
import { initializeBracket } from '@/lib/bracket';
import { getProvider } from '@/lib/simulation';

export const runtime = 'nodejs';

export async function GET() {
  const provider = getProvider();
  const bracket = initializeBracket();
  return NextResponse.json({ bracket, provider });
}
