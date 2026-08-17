import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** GMT "yyyyMMdd HH:mm", the format NOAA's tides-and-currents API accepts. */
export function formatDateTime(date: Date): string {
  const iso = date.toISOString(); // yyyy-MM-ddTHH:mm:ss.sssZ
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}
