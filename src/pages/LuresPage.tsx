import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Lure } from '../types/database'

export default function LuresPage() {
  const { user } = useAuth()
  const [lures, setLures] = useState<Lure[]>([])
  const [loading, setLoading] = useState(true)

  const loadLures = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('lures')
      .select('*')
      .eq('user_id', user.id)
      .order('catch_count', { ascending: false })
    if (data) setLures(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadLures()
  }, [loadLures])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (lures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-5xl mb-4">🎣</div>
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">No lures yet</h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          Your lure library builds itself. Log your first catch and the lure you used will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <h1 className="text-xl font-bold mb-4">Lure Library</h1>
      <div className="grid grid-cols-2 gap-3">
        {lures.map(lure => (
          <div
            key={lure.id}
            className="bg-[var(--color-bg-card)] rounded-xl overflow-hidden border border-[var(--color-border)]"
          >
            <img
              src={lure.photo_url}
              alt={lure.name}
              className="w-full h-28 object-cover"
            />
            <div className="p-2.5">
              <div className="font-medium text-sm text-[var(--color-text)] truncate">
                {lure.name}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {lure.catch_count} {lure.catch_count === 1 ? 'catch' : 'catches'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
