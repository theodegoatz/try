import { RoundName, Region } from '@/types';

// 2026 Tournament Venues
export const VENUES: Record<string, string> = {
  // First Four
  'First Four': 'University of Dayton Arena, Dayton, OH',

  // Round of 64 / Round of 32 pod sites
  'East-1': 'PPG Paints Arena, Pittsburgh, PA',
  'East-2': 'Greensboro Coliseum, Greensboro, NC',
  'West-1': 'Vivint Arena, Salt Lake City, UT',
  'West-2': 'Footprint Center, Phoenix, AZ',
  'Midwest-1': 'T-Mobile Center, Kansas City, MO',
  'Midwest-2': 'Gainbridge Fieldhouse, Indianapolis, IN',
  'South-1': 'Toyota Center, Houston, TX',
  'South-2': 'Dickies Arena, Fort Worth, TX',

  // Regionals (Sweet 16 / Elite Eight)
  'East-Regional': 'Capital One Arena, Washington, D.C.',
  'West-Regional': 'SAP Center, San Jose, CA',
  'Midwest-Regional': 'United Center, Chicago, IL',
  'South-Regional': 'Toyota Center, Houston, TX',

  // Final Four / Championship
  'Final Four': 'Lucas Oil Stadium, Indianapolis, IN',
  'Championship': 'Lucas Oil Stadium, Indianapolis, IN',
};

export function getVenue(round: RoundName, region?: Region, position?: number): string {
  if (round === 'First Four') return VENUES['First Four'];
  if (round === 'Final Four') return VENUES['Final Four'];
  if (round === 'Championship') return VENUES['Championship'];

  if (!region) return 'TBD';

  if (round === 'Round of 64' || round === 'Round of 32') {
    const pod = position !== undefined && position < 2 ? '1' : '2';
    return VENUES[`${region}-${pod}`] || `${region} Pod Site`;
  }

  if (round === 'Sweet 16' || round === 'Elite Eight') {
    return VENUES[`${region}-Regional`] || `${region} Regional`;
  }

  return 'TBD';
}
