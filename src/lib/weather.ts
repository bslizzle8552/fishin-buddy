import type { WeatherData } from '../types/database'

// Using Open-Meteo — free, no API key needed
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`

    const res = await fetch(url)
    if (!res.ok) throw new Error('Weather fetch failed')

    const data = await res.json()
    const current = data.current

    const windDeg = current.wind_direction_10m
    const windDirection = degToCompass(windDeg)

    // Convert hPa to inHg for barometric pressure
    const pressureInHg = current.surface_pressure ? +(current.surface_pressure * 0.02953).toFixed(2) : null

    return {
      temperature_f: current.temperature_2m ? Math.round(current.temperature_2m) : null,
      cloud_cover: classifyCloudCover(current.cloud_cover),
      wind_speed_mph: current.wind_speed_10m ? Math.round(current.wind_speed_10m) : null,
      wind_direction: windDirection,
      barometric_pressure: pressureInHg,
      precipitation: classifyPrecipitation(current.precipitation),
    }
  } catch {
    return {
      temperature_f: null,
      cloud_cover: null,
      wind_speed_mph: null,
      wind_direction: null,
      barometric_pressure: null,
      precipitation: null,
    }
  }
}

function degToCompass(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(deg / 22.5) % 16
  return directions[index]
}

function classifyCloudCover(percent: number | null): string | null {
  if (percent === null) return null
  if (percent <= 10) return 'Clear'
  if (percent <= 25) return 'Mostly Clear'
  if (percent <= 50) return 'Partly Cloudy'
  if (percent <= 75) return 'Mostly Cloudy'
  return 'Overcast'
}

function classifyPrecipitation(inches: number | null): string | null {
  if (inches === null) return null
  if (inches === 0) return 'None'
  if (inches < 0.1) return 'Light'
  if (inches < 0.3) return 'Moderate'
  return 'Heavy'
}
