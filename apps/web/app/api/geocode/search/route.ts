import { NextRequest, NextResponse } from 'next/server';

/** Prizren-ish viewbox: west,north,east,south */
const PRIZREN_VIEWBOX = '20.68,42.26,20.82,42.17';

/**
 * Thin Nominatim proxy so the client never calls OSM directly
 * (User-Agent policy + CORS). Does not touch the Nest API.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '0',
    limit: '6',
    countrycodes: 'xk',
    viewbox: PRIZREN_VIEWBOX,
    bounded: '1',
  });

  const upstream = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PrizrenSmartCity/1.0 (https://github.com/prizren-smart-city; civic-reporting)',
    },
    next: { revalidate: 0 },
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: 'geocode_upstream' }, { status: 502 });
  }

  const data = (await upstream.json()) as unknown;
  return NextResponse.json({ results: Array.isArray(data) ? data : [] });
}
