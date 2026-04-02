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

type CatchRow = Omit<CatchWithLure, 'lure_name' | 'lure_photo_url'> & {
  lure: { name: string; photo_url: string }[] | null
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
      setCatches((catchData as unknown as CatchRow[]).map((c) => {
        const lure = c.lure?.[0]
        return {
          ...c,
          lure_name: lure?.name || 'Unknown',
          lure_photo_url: lure?.photo_url || '',
        }
      }))
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
      <div className="px-4 pb-3 bg-[var(--color-bg)] safe-top-lg">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(-1)}
            className="text-[var(--color-accent)] text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-[var(--color-danger)] text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{spot.name}</h1>
        {water && <div className="text-sm text-[var(--color-text-muted)]">{water.name}</div>}
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          {catches.length} catches logged
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px]">
            <h3 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">Delete Spot?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Delete "{spot.name}" and all its catch history? This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text)] py-3 rounded-xl font-medium border border-[var(--color-border)]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await supabase.from('catches').delete().eq('spot_id', spot.id)
                  await supabase.from('skunk_logs').delete().eq('spot_id', spot.id)
                  await supabase.from('spots').delete().eq('id', spot.id)
                  navigate('/map')
                }}
                className="flex-1 bg-[var(--color-danger)] text-white py-3 rounded-xl font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
