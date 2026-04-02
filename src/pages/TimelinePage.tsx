import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface CatchWithDetails {
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
  caught_at: string
  lure: { name: string; photo_url: string } | null
  spot: { name: string } | null
  water: { name: string } | null
}

export default function TimelinePage() {
  const { user } = useAuth()
  const [catches, setCatches] = useState<CatchWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const loadCatches = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('catches')
      .select(`
        id, species, fish_photo_url, quantity, notes, size_estimate,
        temperature_f, cloud_cover, wind_speed_mph, wind_direction, caught_at,
        lure:lures(name, photo_url),
        spot:spots(name),
        water:waters(name)
      `)
      .eq('user_id', user.id)
      .order('caught_at', { ascending: false })
      .limit(50)

    if (data) setCatches(data as unknown as CatchWithDetails[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadCatches()
  }, [loadCatches])

  // Group by date
  const grouped = catches.reduce<Record<string, CatchWithDetails[]>>((acc, c) => {
    const date = new Date(c.caught_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(c)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (catches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-5xl mb-4">📓</div>
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">No catches yet</h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          Your fishing journal will fill up as you log catches. Head to the Log tab to record your first one.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-4 safe-top-md">
      <h1 className="text-xl font-bold mb-4">Timeline</h1>
      {Object.entries(grouped).map(([date, dayCatches]) => (
        <div key={date} className="mb-5">
          <div className="text-sm font-medium text-[var(--color-text-muted)] mb-2 sticky top-0 bg-[var(--color-bg)] py-1 z-10">
            {date} — {dayCatches.reduce((sum, c) => sum + c.quantity, 0)} fish
          </div>
          <div className="space-y-2">
            {dayCatches.map(c => (
              <CatchCard key={c.id} catch_={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CatchCard({ catch_: c }: { catch_: CatchWithDetails }) {
  const time = new Date(c.caught_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl overflow-hidden border border-[var(--color-border)]">
      {c.fish_photo_url && (
        <img src={c.fish_photo_url} alt={c.species} className="w-full h-40 object-cover" />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <div>
            <span className="font-semibold text-[var(--color-text)]">{c.species}</span>
            {c.quantity > 1 && (
              <span className="text-[var(--color-accent)] ml-1 text-sm">x{c.quantity}</span>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
          {c.spot && <span>📍 {c.spot.name}</span>}
          {c.water && <span className="opacity-60">({c.water.name})</span>}
        </div>

        {c.lure && (
          <div className="flex items-center gap-2 mt-2">
            <img src={c.lure.photo_url} alt={c.lure.name} className="w-8 h-8 rounded object-cover" />
            <span className="text-sm text-[var(--color-text)]">{c.lure.name}</span>
          </div>
        )}

        {/* Weather conditions */}
        {c.temperature_f && (
          <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-muted)]">
            <span>{c.temperature_f}°F</span>
            {c.cloud_cover && <span>{c.cloud_cover}</span>}
            {c.wind_speed_mph != null && <span>{c.wind_speed_mph}mph {c.wind_direction}</span>}
          </div>
        )}

        {c.size_estimate && (
          <div className="text-xs text-[var(--color-text-muted)] mt-1">📏 {c.size_estimate}</div>
        )}
        {c.notes && (
          <div className="text-xs text-[var(--color-text-muted)] mt-1 italic">{c.notes}</div>
        )}
      </div>
    </div>
  )
}
