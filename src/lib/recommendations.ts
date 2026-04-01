import type { WeatherData } from '../types/database'

interface CatchForRecs {
  lure_id: string
  lure_name: string
  lure_photo_url: string
  quantity: number
  temperature_f: number | null
  cloud_cover: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  barometric_pressure: number | null
  precipitation: string | null
  caught_at: string
}

interface Recommendation {
  lure_name: string
  lure_photo_url: string
  catch_count: number
  conditions_summary: string
  when: string
}

// Minimum catches at a spot before recommendations appear
const MIN_CATCHES_FOR_RECS = 5

export function getRecommendations(
  catches: CatchForRecs[],
  currentWeather: WeatherData
): Recommendation[] | null {
  if (catches.length < MIN_CATCHES_FOR_RECS) return null

  // Group catches by similar weather conditions
  const similar = catches.filter(c => isWeatherSimilar(c, currentWeather))

  if (similar.length === 0) return null

  // Group by lure and count
  const lureCounts = new Map<string, {
    lure_name: string
    lure_photo_url: string
    count: number
    latest: string
    conditions: string
  }>()

  for (const c of similar) {
    const existing = lureCounts.get(c.lure_id)
    if (existing) {
      existing.count += c.quantity
      if (c.caught_at > existing.latest) existing.latest = c.caught_at
    } else {
      lureCounts.set(c.lure_id, {
        lure_name: c.lure_name,
        lure_photo_url: c.lure_photo_url,
        count: c.quantity,
        latest: c.caught_at,
        conditions: buildConditionsSummary(c),
      })
    }
  }

  // Sort by catch count descending
  const sorted = [...lureCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return sorted.map(s => ({
    lure_name: s.lure_name,
    lure_photo_url: s.lure_photo_url,
    catch_count: s.count,
    conditions_summary: s.conditions,
    when: formatRelativeDate(s.latest),
  }))
}

function isWeatherSimilar(c: CatchForRecs, current: WeatherData): boolean {
  let score = 0
  let checks = 0

  // Temperature within 10 degrees
  if (c.temperature_f != null && current.temperature_f != null) {
    checks++
    if (Math.abs(c.temperature_f - current.temperature_f) <= 10) score++
  }

  // Same cloud cover category
  if (c.cloud_cover && current.cloud_cover) {
    checks++
    if (c.cloud_cover === current.cloud_cover) score++
  }

  // Barometric pressure within 0.15 inHg
  if (c.barometric_pressure != null && current.barometric_pressure != null) {
    checks++
    if (Math.abs(c.barometric_pressure - current.barometric_pressure) <= 0.15) score++
  }

  // Wind speed within 5 mph
  if (c.wind_speed_mph != null && current.wind_speed_mph != null) {
    checks++
    if (Math.abs(c.wind_speed_mph - current.wind_speed_mph) <= 5) score++
  }

  // Need at least 2 checks and 50%+ match
  return checks >= 2 && score / checks >= 0.5
}

function buildConditionsSummary(c: CatchForRecs): string {
  const parts: string[] = []
  if (c.temperature_f) parts.push(`${c.temperature_f}°F`)
  if (c.cloud_cover) parts.push(c.cloud_cover.toLowerCase())
  if (c.wind_speed_mph) parts.push(`${c.wind_speed_mph}mph wind`)
  return parts.join(', ')
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getDataProgress(catchCount: number): string | null {
  if (catchCount >= MIN_CATCHES_FOR_RECS) return null
  const remaining = MIN_CATCHES_FOR_RECS - catchCount
  return `${remaining} more log${remaining === 1 ? '' : 's'} before recommendations kick in`
}
