import AppPage from "@/components/app-page"

// Without this the route is statically prerendered and the env vars bake in at
// build time, so WEATHERAPP_CITY / WEATHERAPP_TIDE_STATION_ID set at runtime
// (e.g. on the container) would be silently ignored.
export const dynamic = 'force-dynamic'

export default function HomePage() {
  const city = process.env.WEATHERAPP_CITY || 'Madison,CT,USA';
  const stationId = parseInt(process.env.WEATHERAPP_TIDE_STATION_ID || '8465705', 10);
  return <AppPage city={city} stationId={stationId} />
}
