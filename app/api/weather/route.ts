import { NextResponse } from 'next/server';

const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const GEO_URL = 'http://api.openweathermap.org/geo/1.0/direct';

export const dynamic = 'force-dynamic';

async function getCoordinates(city: string) {
  const response = await fetch(`${GEO_URL}?q=${city}&limit=1&appid=${API_KEY}`);
  if (!response.ok) {
    throw new Error('Failed to fetch coordinates');
  }
  const [geoData] = await response.json();
  if (!geoData?.lat || !geoData?.lon) {
    throw new Error('City not found');
  }
  return { lat: geoData.lat, lon: geoData.lon };
}

async function getWeather(lat: number, lon: number) {
  const response = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=imperial&appid=${API_KEY}`
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to fetch weather data');
  }
  return response.json();
}

export async function GET(request: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    
    if (!city) {
      return NextResponse.json(
        { error: 'City parameter is required' },
        { status: 400 }
      );
    }

    const coords = await getCoordinates(city);
    const weatherData = await getWeather(coords.lat, coords.lon);

    return NextResponse.json(weatherData);

  } catch (error) {
    console.error('Weather API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const status = message === 'City not found' ? 404 : 500;
    
    return NextResponse.json({ error: message }, { status });
  }
}