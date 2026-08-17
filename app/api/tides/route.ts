import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export const dynamic = 'force-dynamic';

interface TideParams {
  station: string;
  beginDate: string;
  endDate: string;
}

interface NoaaPrediction {
  t: string;
  v: string;
}

interface NoaaHiLoPrediction {
  t: string;
  v: string;
  type: 'H' | 'L';
}

interface NoaaErrorResponse {
  error?: { message: string };
}

interface TidePredictionOut {
  time: number;
  height: number;
}

interface TideExtremeOut {
  time: number;
  height: number;
  type: 'H' | 'L';
}

// NOAA returns "YYYY-MM-DD HH:mm" in GMT; parse it as such without relying on
// the local timezone of the server.
function parseNoaaTime(t: string): number {
  return Date.parse(`${t.replace(' ', 'T')}:00Z`);
}

class NoaaError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function fetchNoaa(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.append(key, value)
  );

  const response = await fetch(url.toString());
  // NOAA puts its diagnostic in the body for both non-2xx responses and
  // 200-with-error responses, so always read it before deciding.
  const data = await response.json().catch(() => null);
  const noaaMessage = (data as NoaaErrorResponse | null)?.error?.message;

  if (!response.ok) {
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new NoaaError(noaaMessage || `NOAA request failed (HTTP ${response.status})`, status);
  }
  if (!data || noaaMessage) {
    throw new NoaaError(noaaMessage || 'NOAA returned an unreadable response', 400);
  }

  return data;
}

async function fetchPredictions({ station, beginDate, endDate }: TideParams) {
  const data = await fetchNoaa({
    begin_date: beginDate,
    end_date: endDate,
    station,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'gmt',
    units: 'english',
    interval: 'h',
    format: 'json',
  });

  const predictions: NoaaPrediction[] = data.predictions || [];
  return predictions.map((p) => ({
    time: parseNoaaTime(p.t),
    height: parseFloat(p.v),
  }));
}

async function fetchExtremes({ station, beginDate, endDate }: TideParams) {
  const data = await fetchNoaa({
    begin_date: beginDate,
    end_date: endDate,
    station,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'gmt',
    units: 'english',
    interval: 'hilo',
    format: 'json',
  });

  const extremes: NoaaHiLoPrediction[] = data.predictions || [];
  return extremes.map((p) => ({
    time: parseNoaaTime(p.t),
    height: parseFloat(p.v),
    type: p.type,
  }));
}

const getCachedPredictions = unstable_cache(
  async (params: TideParams) => fetchPredictions(params),
  ['tide-predictions'],
  { revalidate: 3600 } // Cache for 1 hour
);

const getCachedExtremes = unstable_cache(
  async (params: TideParams) => fetchExtremes(params),
  ['tide-extremes'],
  { revalidate: 3600 } // Cache for 1 hour
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const station = searchParams.get('station_id');
    const beginDate = searchParams.get('begin_date');
    const endDate = searchParams.get('end_date');

    // Input validation
    if (!station) {
      return NextResponse.json(
        { error: 'Station ID is required' },
        { status: 400 }
      );
    }

    if (!beginDate || !endDate) {
      return NextResponse.json(
        { error: 'Begin date and end date are required' },
        { status: 400 }
      );
    }

    const params: TideParams = { station, beginDate, endDate };

    const [predictions, extremes] = await Promise.all([
      getCachedPredictions(params),
      getCachedExtremes(params),
    ]);

    const response: { predictions: TidePredictionOut[]; extremes: TideExtremeOut[] } = {
      predictions,
      extremes,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Tide API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tide data';
    const status = error instanceof NoaaError ? error.status : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
