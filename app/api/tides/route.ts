import { NextResponse } from 'next/server';
import { TideData } from '@/models/tidePrediction';
import { unstable_cache } from 'next/cache';

const BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export const dynamic = 'force-dynamic';

interface TideParams {
  station: string;
  beginDate: string;
  endDate: string;
  timeZone: string;
}

const getCachedTideData = unstable_cache(
  async (params: TideParams) => fetchTideData(params),
  ['tide-data'],
  { revalidate: 3600 } // Cache for 1 hour
);

async function fetchTideData({ station, beginDate, endDate, timeZone }: TideParams) {
  const url = new URL(BASE_URL);
  const params = {
    begin_date: beginDate,
    end_date: endDate,
    station,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: timeZone,
    units: 'english',
    interval: 'h',
    format: 'json'
  };

  Object.entries(params).forEach(([key, value]) => 
    url.searchParams.append(key, value)
  );

  const response = await fetch(url.toString());
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to fetch tide data');
  }
  return response.json();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const station = searchParams.get('station_id');
    const beginDate = searchParams.get('begin_date');
    const endDate = searchParams.get('end_date');
    const timeZone = searchParams.get('tz') || 'GMT';

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

    const data = await getCachedTideData({
      station,
      beginDate,
      endDate,
      timeZone
    });

    // Map the data to the TideData object
    const tideData: TideData = {
      predictions: data.predictions.map((prediction: { t: string; v: string }) => ({
        time: prediction.t,
        height: parseFloat(prediction.v)
      }))
    };

    return NextResponse.json(tideData);

  } catch (error) {
    console.error('Tide API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tide data';
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}