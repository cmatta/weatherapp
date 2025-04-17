# Weather App

A modern weather application built with Next.js that displays weather conditions and tide predictions.

![Weather App](weatherapp.png)


## Features

- Real-time weather information
- Tide height predictions with interactive charts
- Dynamic weather icons based on conditions:
  - Clear sky
  - Few clouds
  - Scattered clouds
  - Broken clouds
  - Shower rain
  - Rain
  - Thunderstorm
  - Snow
  - Mist
- Responsive design with Tailwind CSS

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide React](https://lucide.dev/) - Icons

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file with your API keys:
   ```env
   # Get an OpenWeatherMap API Key: https://openweathermap.org/
   OPENWEATHERMAP_API_KEY=<API_KEY>
   # Must be (<CITY>,<STATECODE>,<COUNTRYCODE>) supported by Openweathermap Geocoding API: https://openweathermap.org/api/geocoding-api
   WEATHERAPP_CITY='Madison,CT,USA' 
   # Find tide station at https://tidesandcurrents.noaa.gov/
   WEATHERAPP_TIDE_STATION_ID=8465705
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.
