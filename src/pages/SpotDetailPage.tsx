import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fetchWeather } from '../lib/weather'
import { getRecommendations, getDataProgress } from '../lib/recommendations'
import type { Spot, Water, WeatherData } from '../types/database'

interface CatchWithLure {
  id: string
  species: string
  fish_photo_url: string | null
  quantity: number
  notes: string | null
  size_estimate: string | null
  temperature_f: number | null
  cloud_cover: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  barometric_pressure: number | null
  precipitation: string | null
  caught_at: string
  lure_id: string
  lure_name: string
  lure_photo_url: string
}

export default function SpotDetailPage() {
  const { spotId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [spot, setSpot] = useState<Spot | null>(null)
  const [water, setWater] = useState<Water | null>(null)
  const [catches, setCatches] = useState<CatchWithLure[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSpotData = useCallback(async () => {
    if (!user || !spotId) return

    // Load spot
    const { data: spotData } = await supabase
      .from('spots')
      .select('*')
      .eq('id', spotId)
      .single()
    if (!spotData) return
    setSpot(spotData)

    // Load water
    const { data: waterData } = await supabase
      .from('waters')
      .select('*')
      .eq('id', spotData.water_id)
      .single()
    if (waterData) setWater(waterData)

    // Load catches with lure info
    const { data: catchData } = await supabase
      .from('catches')
      .select(`
        id, species, fish_photo_url, quantity, notes, size_estimate,
        temperature_f, cloud_cover, wind_speed_mph, wind_direction,
        barometric_pressure, precipitation, caught_at, lure_id,
        lure:lures(name, photo_url)
      `)
      .eq('spot_id', spotId)
      .order('caught_at', { ascending: false })

    if (catchData) {
      setCatches(catchData.map((c: any) => ({
        ...c,
        lure_name: c.lure?.name || 'Unknown',
        lure_photo_url: c.lure?.photo_url || '',
      })))
    }

    // Get current weather for recommendations
    const w = await fetchWeather(spotData.latitude, spotData.longitude)
    setWeather(w)

    setLoading(false)
  }, [user, spotId])

  useEffect(() => {
    loadSpotData()
  }, [loadSpotData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!spot) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Spot not found
      </div>
    )
  }

  const recs = weather ? getRecommendations(catches, weather) : null
  const progress = getDataProgress(catches.length)

  return (
    <div className="h-full overflow-y-auto pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-[var(--color-bg)]">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--color-accent)] text-sm mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{spot.name}</h1>
        {water && <div className="text-sm text-[var(--color-text-muted)]">{water.name}</div>}
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          {catches.length} catches logged
        </div>
      </div>

      {/* Current weather */}
      {weather && weather.temperature_f && (
        <div className="mx-4 mt-3 flex items-center gap-3 text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-card)] rounded-xl px-3 py-2 border border-[var(--color-border)]">
          <span className="font-medium text-[var(--color-text)]">Now:</span>
          <span>{weather.temperature_f}°F</span>
          {weather.cloud_cover && <span>{weather.cloud_cover}</span>}
          {weather.wind_speed_mph != null && <span>{weather.wind_speed_mph}mph {weather.wind_direction}</span>}
          {weather.barometric_pressure && <span>{weather.barometric_pressure}"</span>}
        </div>
      )}

      {/* Recommendations — only shows when enough data */}
      {recs && recs.length > 0 && (
        <div className="mx-4 mt-3">
          <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-2">
            What's worked in similar conditions
          </h3>
          <div className="space-y-2">
            {recs.map((rec, i) => (
              <div key={i} className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-accent)]/30 flex items-center gap-3">
                <img src={rec.lure_photo_url} alt={rec.lure_name} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-[var(--color-text)]">{rec.lure_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {rec.catch_count} fish — {rec.conditions_summary}
                  </div>
                  <div className="text-xs text-[var(--color-accent)]">{rec.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data progress - transparent about building intelligence */}
      {progress && (
        <div className="mx-4 mt-3 text-xs text-[var(--color-warning)] bg-[var(--color-warning)]/10 rounded-xl px-3 py-2">
          {progress}
        </div>
      )}

      {/* Catch history */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">Catch History</h3>
        {catches.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No catches at this spot yet.</p>
        ) : (
          <div className="space-y-2">
            {catches.map(c => {
              const date = new Date(c.caught_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })
              const time = new Date(c.caught_at).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit',
              })
              return (
                <div key={c.id} className="bg-[var(--color-bg-card)] rounded-xl overflow-hidden border border-[var(--color-border)]">
                  {c.fish_photo_url && (
                    <img src={c.fish_photo_url} alt={c.species} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-sm text-[var(--color-text)]">{c.species}</span>
                        {c.quantity > 1 && <span className="text-[var(--color-accent)] text-xs ml-1">x{c.quantity}</span>}
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">{date} {time}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {c.lure_photo_url && (
                        <img src={c.lure_photo_url} alt={c.lure_name} className="w-6 h-6 rounded object-cover" />
                      )}
                      <span className="text-xs text-[var(--color-text-muted)]">{c.lure_name}</span>
                    </div>
                    {c.temperature_f && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        {c.temperature_f}°F {c.cloud_cover} {c.wind_speed_mph ? `${c.wind_speed_mph}mph` : ''}
                      </div>
                    )}
                    {c.notes && <div className="text-xs text-[var(--color-text-muted)] mt-1 italic">{c.notes}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
