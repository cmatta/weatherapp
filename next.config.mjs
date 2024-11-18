/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,
  },
  publicRuntimeConfig: {
    NEXT_PUBLIC_OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,
  },
};

export default nextConfig;
