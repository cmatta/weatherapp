import AppPage from "@/components/app-page"

export default function HomePage() {
  const city = process.env.WEATHERAPP_CITY || 'Madison,CT,USA';
  const stationId = parseInt(process.env.WEATHERAPP_TIDE_STATION_ID || '8465705', 10);
  return <AppPage city={city} stationId={stationId} />
}
