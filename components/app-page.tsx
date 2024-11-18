'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from 'recharts'
import { Sun, Cloud, CloudRain, Waves, CloudLightning, CloudDrizzle, CloudSnow, Moon as MoonIcon} from 'lucide-react'
import { WeatherData } from '../models/weatherData'
import { TideData, TidePrediction } from '../models/tidePrediction'
import { formatDateTime } from '../lib/utils'

const timeZone = 'America/New_York';

function getWeatherIcon(description: string, current?: { sunset?: number, moonPhase?: number }, isCurrentWeather = false) {
  // Only check for night/moon if this is the current weather box
  if (isCurrentWeather && current?.sunset && Date.now() / 1000 > current.sunset) {
    return <MoonIcon className="w-8 h-8 text-gray-400" />
  }

  switch (description.toLowerCase()) {
    case 'clear sky':
      return <Sun className="w-8 h-8 text-yellow-500" />
    case 'few clouds':
    case 'scattered clouds':
    case 'broken clouds':
      return <Cloud className="w-8 h-8 text-gray-500" />
    case 'shower rain':
      return <CloudDrizzle className="w-8 h-8 text-blue-400" />
    case 'rain':
      return <CloudRain className="w-8 h-8 text-blue-500" />
    case 'thunderstorm':
      return <CloudLightning className="w-8 h-8 text-yellow-600" />
    case 'snow':
      return <CloudSnow className="w-8 h-8 text-blue-200" />
    case 'mist':
      return <Cloud className="w-8 h-8 text-gray-400" />
    default:
      return <Sun className="w-8 h-8 text-yellow-500" />
  }
}

export function Page() {
  const city = process.env.WEATHERAPP_CITY || 'Madison,CT,USA' // Set default city from environment variable
  const stationId = parseInt(process.env.WEATHERAPP_TIDE_STATION_ID || '8465705', 10) // Tide Station New Haven from environment variable
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [tides, setTides] = useState<TideData | null>(null)
  const [error, setError] = useState('')

  // Add a time dependency that updates every minute
  const currentTime = useMemo(() => Date.now(), [Math.floor(Date.now() / (60 * 1000))])

  const dates = useMemo(() => {
    return {
      beginDate: new Date(currentTime - 12 * 60 * 60 * 1000),
      endDate: new Date(currentTime + 12 * 60 * 60 * 1000)
    }
  }, [currentTime])  // Depend on currentTime

  const handleFetchWeatherAndTides = useCallback(async () => {
    setError('')
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
    }
  }, [city, stationId, dates.beginDate, dates.endDate])

  useEffect(() => {
    handleFetchWeatherAndTides()
  }, [handleFetchWeatherAndTides])

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Weather Forecast for {city.includes(',') ? city.split(',')[0] : city}</CardTitle>
          <p className='text-xs text-right'>Last Refresh: {new Date(currentTime).toLocaleTimeString()}</p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {weather && (
            <>
              <div className="grid grid-cols-6 gap-4 mb-6">
                <div className="col-span-2 bg-primary/10 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    {getWeatherIcon(weather.current.weather[0].main, {
                      sunset: weather.current.sunset,
                      moonPhase: weather.daily[0].moon_phase
                    }, true)}
                    <div className="text-3xl font-bold">{Math.round(weather.current.temp)}°F</div>
                  </div>
                  <div className="mt-2">
                    <div>{weather.current.weather[0].description}</div>
                    <div>H: {Math.round(weather.daily[0].temp.max)}° L: {Math.round(weather.daily[0].temp.min)}°</div>
                  </div>
                </div>
                {weather.daily.slice(1, 5).map((day, index) => (
                  <div key={index} className="text-center bg-secondary/10 p-2 rounded-lg">
                    <div className="text-sm">{new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    {getWeatherIcon(day.weather[0].main)}
                    <div className="text-sm font-semibold">
                      High: {Math.round(day.temp.max)}°F, Low: {Math.round(day.temp.min)}°F
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Tide Chart</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={tides?.predictions
                      .filter(pred => {
                        const predTime = new Date(pred.time + ' GMT');
                        return predTime >= new Date(dates.beginDate) && predTime <= new Date(dates.endDate);
                      })
                      .map(pred => ({
                      ...pred,
                      time: new Date(pred.time + ' GMT').getTime(),
                      height: pred.height
                    })) || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(time: string) => 
                        new Date(time).toLocaleString('en-US', { hour: 'numeric', timeZone: timeZone })
                      }
                      type="category"
                      domain={['dataMin', 'dataMax']}
                      scale="time"
                    />
                    <YAxis 
                      domain={[
                        (min: number) => Math.floor(min) - 0.5, 
                        (max: number) => Math.ceil(max) + 0.5
                      ]} 
                    />
                  <Tooltip
                      labelFormatter={(label: string) => new Date(label).toLocaleString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric', 
                        hour: 'numeric', 
                        minute: 'numeric', 
                        timeZone: timeZone
                      })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="height" 
                      fill="rgba(0, 128, 255, 0.2)" 
                      stroke="none" 
                      isAnimationActive={false}
                      baseValue="dataMin"
                    />
                    <Line
                      type="monotone"
                      dataKey="height"
                      stroke="#8884d8"
                    />  
                    <ReferenceLine
                      x={(() => {
                        // Use exact current time
                        const now = new Date().getTime(); // Use timestamp for precise positioning
                        return now;
                      })()}                      
                      stroke="red"
                      strokeWidth={2}
                      label={{ value: 'Now', position: 'insideTopRight' }}
                    />                  
                    </LineChart>
                </ResponsiveContainer>
                {tides && (
                  <div className="flex items-center justify-center mt-2">
                    <Waves className="w-5 h-5 mr-2 text-blue-500" />
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
