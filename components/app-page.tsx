'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
const TideChart = dynamic(() => import('./TideChart'), { ssr: false })
import { Sun, Cloud, CloudRain, Waves, CloudLightning, CloudDrizzle, CloudSnow } from 'lucide-react'
import { WeatherData } from '../models/weatherData'
import { TideData, TideExtreme } from '../models/tidePrediction'
import { formatDateTime } from '../lib/utils'
import MoonPhaseIcon, { type MoonPhaseType } from './moonPhase'

const timeZone = 'America/New_York';
const REFRESH_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// Asymmetric window: extremes alternate every ~6.2h, so a symmetric ±12h span
// leaves only 12h of future and can hold just one upcoming extreme, silently
// dropping the next High or Low from the display.
const TIDE_WINDOW_BACK_MS = 4 * HOUR_MS;
const TIDE_WINDOW_FORWARD_MS = 20 * HOUR_MS;
// The frame is 800x480 minus the 2px border and p-3 padding on each side.
const CONTENT_WIDTH = 772;

function mapMoonPhaseToType(phaseValue: number): MoonPhaseType {
  // Tolerance bands: OWM reports a float, so exact hits on 0/0.25/0.5/0.75
  // essentially never occur.
  const EPS = 0.02;
  if (phaseValue < EPS || phaseValue > 1 - EPS) return 'new';
  if (Math.abs(phaseValue - 0.25) <= EPS) return 'firstQuarter';
  if (Math.abs(phaseValue - 0.5) <= EPS) return 'full';
  if (Math.abs(phaseValue - 0.75) <= EPS) return 'lastQuarter';
  if (phaseValue < 0.25) return 'waxingCrescent';
  if (phaseValue < 0.5) return 'waxingGibbous';
  if (phaseValue < 0.75) return 'waningGibbous';
  return 'waningCrescent';
}

// Takes an OpenWeatherMap `weather[0].main` group, not a description string.
function getWeatherIcon(main: string, size: number) {
  const props = { size, strokeWidth: 2.25 };
  switch (main.toLowerCase()) {
    case 'clouds':
    // Atmosphere group: no dedicated icon, and haze reads as overcast anyway.
    case 'mist':
    case 'fog':
    case 'haze':
    case 'smoke':
    case 'dust':
    case 'sand':
    case 'ash':
    case 'squall':
    case 'tornado':
      return <Cloud {...props} />
    case 'rain':
      return <CloudRain {...props} className="text-inky-blue" />
    case 'drizzle':
      return <CloudDrizzle {...props} className="text-inky-blue" />
    case 'thunderstorm':
      return <CloudLightning {...props} className="text-inky-red" />
    case 'snow':
      return <CloudSnow {...props} className="text-inky-blue" />
    case 'clear':
    default:
      // Orange, not yellow: #FFFF00 on white all but vanishes after dithering.
      return <Sun {...props} className="text-inky-orange" />
  }
}

// One temperature format everywhere. The colors carry "high" and "low", so the
// words and the unit come off.
function TempRange({ high, low, className }: { high: number; low: number; className?: string }) {
  return (
    <div className={`whitespace-nowrap ${className ?? ''}`}>
      <span className="text-inky-red">{Math.round(high)}°</span>
      <span className="px-0.5">/</span>
      <span className="text-inky-blue">{Math.round(low)}°</span>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 800,
        height: 480,
        overflow: "hidden",
        position: "relative",
        background: "#fff",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
      data-testid="inky-root"
    >
      <div className="flex h-full w-full flex-col overflow-hidden border-2 border-black bg-background p-3 text-foreground">
        {children}
      </div>
    </div>
  )
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(`${label}: ${detail}`);
  }
  if (!body) throw new Error(`${label}: response was not JSON`);
  return body as T;
}

type AppPageProps = {
  city: string;
  stationId: number;
};

export default function AppPage({ city, stationId }: AppPageProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [tides, setTides] = useState<TideData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // Timestamp of the last successful fetch. Everything time-relative on the
  // frame is computed against it, so the whole display is internally consistent.
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const handleFetchWeatherAndTides = useCallback(async () => {
    const requestedAt = Date.now();
    setError('');
    try {
      // Round the window to the hour so repeated fetches share a server cache key.
      const windowStart = Math.floor((requestedAt - TIDE_WINDOW_BACK_MS) / HOUR_MS) * HOUR_MS;
      const windowEnd = Math.floor((requestedAt + TIDE_WINDOW_FORWARD_MS) / HOUR_MS) * HOUR_MS;
      const tideParams = new URLSearchParams({
        station_id: String(stationId),
        begin_date: formatDateTime(new Date(windowStart)),
        end_date: formatDateTime(new Date(windowEnd)),
      });
      const [weatherData, tideData] = await Promise.all([
        fetchJson<WeatherData>(`/api/weather?city=${encodeURIComponent(city)}`, 'Weather'),
        fetchJson<TideData>(`/api/tides?${tideParams}`, 'Tides'),
      ]);

      setWeather(weatherData);
      setTides(tideData);
      setLastRefresh(requestedAt);
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false); // Finish loading regardless of success/error
    }
  }, [city, stationId])

  useEffect(() => {
    handleFetchWeatherAndTides()
    const interval = setInterval(handleFetchWeatherAndTides, REFRESH_MS)
    return () => clearInterval(interval)
  }, [handleFetchWeatherAndTides])

  const referenceTime = lastRefresh ?? 0;

  // Next high and low come straight from the NOAA hilo extremes.
  const { nextHighTide, nextLowTide } = useMemo(() => {
    const upcoming = (tides?.extremes ?? [])
      .filter(extreme => extreme.time > referenceTime)
      .sort((a, b) => a.time - b.time);
    return {
      nextHighTide: upcoming.find(e => e.type === 'H') ?? null,
      nextLowTide: upcoming.find(e => e.type === 'L') ?? null,
    };
  }, [tides, referenceTime]);

  const currentTideHeight = useMemo(() => {
    const predictions = tides?.predictions ?? [];
    if (predictions.length === 0) return null;
    const nearest = predictions.reduce((closest, prediction) =>
      Math.abs(prediction.time - referenceTime) < Math.abs(closest.time - referenceTime)
        ? prediction
        : closest
    );
    return nearest.height;
  }, [tides, referenceTime]);

  if (isLoading) {
    return (
      <Frame>
        <div className="flex h-full items-center justify-center text-3xl font-bold">Loading…</div>
      </Frame>
    )
  }

  // A transient fetch failure shouldn't blank a frame that still holds good
  // data; the stale "Updated" time already shows the reader how old it is.
  if (!weather || !tides) {
    return (
      <Frame>
        <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
          <p className="text-4xl font-bold text-inky-red">Weather unavailable</p>
          <p className="break-words text-xl font-semibold">{error || 'No data returned'}</p>
          {lastRefresh && (
            <p className="text-base font-semibold">
              Last good update{' '}
              {new Date(lastRefresh).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
      </Frame>
    )
  }

  const cityName = city.includes(',') ? city.split(',')[0] : city;
  const isNight =
    referenceTime < weather.current.sunrise * 1000 || referenceTime > weather.current.sunset * 1000;
  const dayLabel = (dt: number) => {
    const date = new Date(dt * 1000);
    return `${date.toLocaleDateString('en-US', { timeZone, weekday: 'short' })} ${date.toLocaleDateString('en-US', { timeZone, day: 'numeric' })}`;
  };
  const tideLabel = (extreme: TideExtreme) =>
    `${extreme.height.toFixed(1)} ft at ${new Date(extreme.time).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}`;

  return (
    <Frame>
      <header className="flex flex-none items-end justify-between border-b-2 border-black pb-2">
        <h1 className="text-[34px] font-bold leading-none">{cityName}</h1>
        <div className="text-right leading-tight">
          <div className="text-lg font-bold">
            {new Date(referenceTime).toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="text-sm font-semibold">
            Updated {new Date(referenceTime).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <div className="mt-3 grid h-[150px] flex-none grid-cols-6 gap-2">
        <div className="col-span-2 flex flex-col border-2 border-black p-2">
          <div className="text-base font-bold">Now</div>
          <div className="flex flex-1 items-center justify-between">
            {isNight && weather.current.weather[0].main.toLowerCase() === 'clear' ? (
              // Moon only on clear nights — a rainy night should still show rain.
              <MoonPhaseIcon phase={mapMoonPhaseToType(weather.daily[0].moon_phase)} size={48} />
            ) : (
              getWeatherIcon(weather.current.weather[0].main, 48)
            )}
            <div className="text-[44px] font-bold leading-none">{Math.round(weather.current.temp)}°</div>
          </div>
          <div className="truncate text-base font-semibold capitalize">
            {weather.current.weather[0].description}
          </div>
          <TempRange
            high={weather.daily[0].temp.max}
            low={weather.daily[0].temp.min}
            className="text-xl font-bold"
          />
        </div>
        {weather.daily.slice(1, 5).map((day) => (
          <div key={day.dt} className="flex flex-col items-center justify-between border-2 border-black p-2">
            <div className="text-base font-bold">{dayLabel(day.dt)}</div>
            {getWeatherIcon(day.weather[0].main, 44)}
            <TempRange high={day.temp.max} low={day.temp.min} className="text-lg font-bold" />
          </div>
        ))}
      </div>

      <div
        data-testid="tide-info"
        className="mt-3 flex flex-none items-baseline justify-between border-b-2 border-black pb-1"
      >
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Waves size={22} strokeWidth={2.5} className="text-inky-blue" />
          Tides
        </h2>
        <div className="flex items-baseline gap-5 text-base font-bold">
          {currentTideHeight !== null && <span>Now {currentTideHeight.toFixed(1)} ft</span>}
          {nextHighTide && <span className="text-inky-red">High {tideLabel(nextHighTide)}</span>}
          {nextLowTide && <span className="text-inky-blue">Low {tideLabel(nextLowTide)}</span>}
        </div>
      </div>

      <div className="mt-2 flex-none">
        <TideChart
          chartData={tides.predictions}
          extremes={tides.extremes}
          now={referenceTime}
          timeZone={timeZone}
          width={CONTENT_WIDTH}
          height={172}
        />
      </div>
    </Frame>
  )
}
