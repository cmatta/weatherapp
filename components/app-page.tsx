'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import dynamic from 'next/dynamic'
const TideChart = dynamic(() => import('./TideChart'), { ssr: false })
const MinimalChart = dynamic(() => import('./MinimalChart'), { ssr: false })
import { Sun, Cloud, CloudRain, Waves, CloudLightning, CloudDrizzle, CloudSnow } from 'lucide-react'
import { WeatherData } from '../models/weatherData'
import { TideData, TidePrediction } from '../models/tidePrediction'
import { formatDateTime } from '../lib/utils'
import MoonPhaseIcon, { type MoonPhaseType } from './moonPhase'

const timeZone = 'America/New_York';

function mapMoonPhaseToType(phaseValue: number): MoonPhaseType {
  if (phaseValue === 0 || phaseValue === 1) return 'new';
  if (phaseValue > 0 && phaseValue < 0.25) return 'waxingCrescent';
  if (phaseValue === 0.25) return 'firstQuarter';
  if (phaseValue > 0.25 && phaseValue < 0.5) return 'waxingGibbous';
  if (phaseValue === 0.5) return 'full';
  if (phaseValue > 0.5 && phaseValue < 0.75) return 'waningGibbous';
  if (phaseValue === 0.75) return 'lastQuarter';
  if (phaseValue > 0.75 && phaseValue < 1) return 'waningCrescent';
  return 'new'; // Default fallback
}

function getWeatherIcon(description: string, current?: { sunset?: number, moonPhase?: number }, isCurrentWeather = false) {
  // Only check for night/moon if this is the current weather box
  if (isCurrentWeather && current?.sunset && Date.now() / 1000 > current.sunset) {
    // Use the mapping function
    const phaseType = mapMoonPhaseToType(current.moonPhase ?? 0);
    return <MoonPhaseIcon phase={phaseType} size={32} /> 
  }

  switch (description.toLowerCase()) {
    case 'clear sky':
      return <Sun className="w-8 h-8 text-chart-3" /> // Yellow
    case 'few clouds':
    case 'scattered clouds':
    case 'broken clouds':
      return <Cloud className="w-8 h-8" /> // Black (default foreground)
    case 'shower rain':
      return <CloudDrizzle className="w-8 h-8 text-accent" /> // Blue
    case 'rain':
      return <CloudRain className="w-8 h-8 text-accent" /> // Blue
    case 'thunderstorm':
      return <CloudLightning className="w-8 h-8 text-destructive" /> // Red
    case 'snow':
      return <CloudSnow className="w-8 h-8 text-accent" /> // Blue
    case 'mist':
      return <Cloud className="w-8 h-8" /> // Black (default foreground)
    default:
      return <Sun className="w-8 h-8 text-chart-3" /> // Yellow
  }
}

type AppPageProps = {
  city: string;
  stationId: number;
};

export default function AppPage({ city, stationId }: AppPageProps) {

  // Add a time dependency that updates every 30 minutes
  const timeIntervalKey = Math.floor(Date.now() / (30 * 60 * 1000)); 
  const currentTime = useMemo(() => Date.now(), [timeIntervalKey]);

  // State to hold the time *after* client-side hydration
  const [clientTime, setClientTime] = useState<number | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);
  

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [tides, setTides] = useState<TideData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Set clientTime after component mounts
  useEffect(() => {
    setClientTime(currentTime);
  }, [currentTime]); // Update if currentTime changes due to 30min interval

  const dates = useMemo(() => {
    return {
      beginDate: new Date(currentTime - 12 * 60 * 60 * 1000),
      endDate: new Date(currentTime + 12 * 60 * 60 * 1000)
    }
  }, [currentTime])  // Depend on currentTime

  const handleFetchWeatherAndTides = useCallback(async () => {
    setError('')
    setIsLoading(true); // Start loading
    try {
      const [weatherResponse, tideResponse] = await Promise.all([
        fetch(`/api/weather?city=${city}`),
        fetch(`/api/tides?station_id=${stationId}&begin_date=${formatDateTime(dates.beginDate)}&end_date=${formatDateTime(dates.endDate)}&tz=GMT`)
      ]);
      const weatherData = await weatherResponse.json();
      const tideData = await tideResponse.json();

      setWeather(weatherData);
      setTides(tideData);

    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false); // Finish loading regardless of success/error
    }
  }, [city, stationId, dates.beginDate, dates.endDate])

  useEffect(() => {
    handleFetchWeatherAndTides()
  }, [handleFetchWeatherAndTides])

  useEffect(() => {
    if (weather?.current) {
      console.log('weather.current:', weather.current);
    }
  }, [weather]);

  // Find next high and low tides after the current time
  const { nextHighTide, nextLowTide } = useMemo(() => {
    let nextHigh: TidePrediction | null = null;
    let nextLow: TidePrediction | null = null;

    if (tides?.predictions && tides.predictions.length >= 3) {
      // Ensure predictions are sorted by time
      const sortedPredictions = [...tides.predictions].sort((a, b) => new Date(a.time + ' GMT').getTime() - new Date(b.time + ' GMT').getTime());

      for (let i = 1; i < sortedPredictions.length - 1; i++) {
        const predTimeMs = new Date(sortedPredictions[i].time + ' GMT').getTime();
        
        // Only consider predictions after the current time
        if (predTimeMs > currentTime) {
          const prevHeight = sortedPredictions[i - 1].height;
          const currentHeight = sortedPredictions[i].height;
          const nextHeight = sortedPredictions[i + 1].height;

          // Check for local maximum (High Tide)
          if (currentHeight > prevHeight && currentHeight > nextHeight && !nextHigh) {
            nextHigh = sortedPredictions[i];
          }
          
          // Check for local minimum (Low Tide)
          if (currentHeight < prevHeight && currentHeight < nextHeight && !nextLow) {
            nextLow = sortedPredictions[i];
          }
        }
        
        // Stop searching if both are found after current time
        if (nextHigh && nextLow) {
          break;
        }
      }
    }
    return { nextHighTide: nextHigh, nextLowTide: nextLow };
  }, [tides, currentTime]); // Recalculate when tides or currentTime changes

  // Prepare chart data for tide chart
  const chartData = tides?.predictions
    .filter(pred => {
      const predTime = new Date(pred.time + ' GMT');
      return predTime >= new Date(dates.beginDate) && predTime <= new Date(dates.endDate);
    })
    .map(pred => ({
      ...pred,
      time: new Date(pred.time + ' GMT').getTime(), // Use timestamp for chart
      height: pred.height
    })) || [];
  if (hasMounted) {
    console.log("Tide chart data", chartData);
    // Expose chartData for browser debugging
    // window.chartData = chartData; // Clean up after debugging
  }

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
      <div className="p-4 border border-black bg-background text-foreground w-full h-full overflow-hidden">
      <Card className="w-full h-full border-none shadow-none rounded-none bg-transparent">
        <CardHeader className="pb-2 pt-2">
          <CardTitle className="text-xl">Weather for {city.includes(',') ? city.split(',')[0] : city}</CardTitle>
          {/* Only render time after client mount */}
          {hasMounted && clientTime && (
            <p className='text-xs text-right'>Last Refresh: {new Date(clientTime).toLocaleTimeString([], { timeZone: timeZone, hour: 'numeric', minute: '2-digit' })}</p>
          )}
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">Error: {error}</p>} 
          {isLoading && !error && <p>Loading...</p>}

          {!isLoading && !error && weather && tides && (
            <>
              <div className="grid grid-cols-6 gap-4 mb-6">
                <div className="col-span-2 p-4 rounded-lg border border-black"> 
                  <div className="flex items-center justify-between">
                    {getWeatherIcon(weather.current.weather[0].main, {
                      sunset: weather.current.sunset,
                      moonPhase: weather.daily[0].moon_phase
                    }, true)}
                    <div className="text-3xl font-bold">{Math.round(weather.current.temp)}°F</div>
                  </div>
                  <div className="mt-2">
                    <div>{weather.current.weather[0].description}</div>
                    <div>
                      H: <span className="text-[var(--inky-red)]">{Math.round(weather.daily[0].temp.max)}°</span> L: <span className="text-[var(--inky-blue)]">{Math.round(weather.daily[0].temp.min)}°</span>
                    </div>
                  </div>
                </div>
                {weather.daily.slice(1, 5).map((day, index) => (
                  <div key={index} className="text-center p-2 rounded-lg border border-black">
                    <div className="text-sm">{new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="flex justify-center w-full mb-1">{getWeatherIcon(day.weather[0].main)}</div>
                    <div className="text-sm font-semibold">
                      High: <span className="text-[var(--inky-red)]">{Math.round(day.temp.max)}°F</span>, Low: <span className="text-[var(--inky-blue)]">{Math.round(day.temp.min)}°F</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Tide Chart</h3>
                {hasMounted && (
                  <>
                    <TideChart chartData={chartData} timeZone={timeZone} />
                  </>
                )}

                {tides && (
                  <div data-testid="tide-info" className="flex items-center justify-center mt-2">
                    <Waves className="w-5 h-5 mr-2 text-[var(--inky-blue)]" /> {/* Blue Waves icon using variable */}
                    <span className="font-semibold">
                      Current Tide: {
                        tides.predictions.reduce((closest: TidePrediction | null , current: TidePrediction) => {
                          // Convert GMT time to local time (not sure why this is necessary???)
                          const currentTime = new Date(current.time + ' GMT').getTime();
                          const now = Date.now();
                          const diff = Math.abs(currentTime - now);
                          if (!closest || diff < Math.abs(new Date(closest.time + ' GMT').getTime() - now)) {
                            return current;
                          }
                          return closest;
                        }, null)?.height.toFixed(2)
                      }ft
                    </span>                    
                  </div>
                )}
                {/* Display Next High/Low Tides */}
                { (nextHighTide || nextLowTide) && (
                  <div className="text-center mt-2 text-xs">
                    {nextHighTide && (
                      <p className="mb-1">
                        Next High: {nextHighTide.height.toFixed(1)} ft at{' '}
                        {new Date(nextHighTide.time + ' GMT').toLocaleTimeString([], { timeZone: timeZone, hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                    {nextLowTide && (
                      <p>
                        Next Low: {nextLowTide.height.toFixed(1)} ft at{' '}
                        {new Date(nextLowTide.time + ' GMT').toLocaleTimeString([], { timeZone: timeZone, hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                    {!nextHighTide && !nextLowTide && tides?.predictions?.length > 0 && (
                      <p className="text-sm">Tide data available, but next high/low not found in the upcoming window.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
