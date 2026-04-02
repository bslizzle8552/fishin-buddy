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
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadCatches = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
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
      .limit(100)

    if (data) setCatches(data as unknown as CatchWithDetails[])
    if (error) console.error('Load catches error:', error)
    setLoading(false)
  }, [user])

  useEffect(() => { loadCatches() }, [loadCatches])

  const handleDelete = async () => {
    if (!deleteId) return
    await supabase.from('catches').delete().eq('id', deleteId)
    setDeleteId(null)
    loadCatches()
  }

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
          Your fishing journal will fill up as you log catches.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <h1 className="text-xl font-bold mb-4">Timeline</h1>
      {Object.entries(grouped).map(([date, dayCatches]) => (
        <div key={date} className="mb-5">
          <div className="text-sm font-medium text-[var(--color-text-muted)] mb-2 sticky top-0 bg-[var(--color-bg)] py-1 z-10">
            {date} — {dayCatches.reduce((sum, c) => sum + c.quantity, 0)} fish
          </div>
          <div className="space-y-2">
            {dayCatches.map(c => (
              <CatchCard key={c.id} catch_={c} onDelete={() => setDeleteId(c.id)} />
            ))}
          </div>
        </div>
      ))}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteId(null)} />
          <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px]">
            <h3 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">Delete Catch?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">Remove this catch from your history? This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text)] py-3 rounded-xl font-medium border border-[var(--color-border)]">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 bg-[var(--color-danger)] text-white py-3 rounded-xl font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CatchCard({ catch_: c, onDelete }: { catch_: CatchWithDetails; onDelete: () => void }) {
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
            <button onClick={onDelete} className="text-[var(--color-text-muted)] p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
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
