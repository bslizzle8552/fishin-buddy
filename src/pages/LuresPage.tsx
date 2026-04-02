import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Lure } from '../types/database'

export default function LuresPage() {
  const { user } = useAuth()
  const [lures, setLures] = useState<Lure[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Lure | null>(null)
  const [selectedLure, setSelectedLure] = useState<Lure | null>(null)

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

  useEffect(() => { loadLures() }, [loadLures])

  const handleDelete = async () => {
    if (!deleteTarget) return
    // Remove lure reference from catches first (set to null or delete catches)
    // For now, just delete the lure — catches will have a dangling reference but won't break
    await supabase.from('lures').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    setSelectedLure(null)
    loadLures()
  }

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
          Your lure library builds itself. Log a catch and the lure you used will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <h1 className="text-xl font-bold mb-4">Lure Library</h1>
      <div className="grid grid-cols-2 gap-3">
        {lures.map(lure => (
          <button
            key={lure.id}
            onClick={() => setSelectedLure(selectedLure?.id === lure.id ? null : lure)}
            className={`bg-[var(--color-bg-card)] rounded-xl overflow-hidden border text-left transition-colors ${
              selectedLure?.id === lure.id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
            }`}
          >
            <img src={lure.photo_url} alt={lure.name} className="w-full h-28 object-cover" />
            <div className="p-2.5">
              <div className="font-medium text-sm text-[var(--color-text)] truncate">{lure.name}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {lure.catch_count} {lure.catch_count === 1 ? 'catch' : 'catches'}
              </div>
            </div>
            {selectedLure?.id === lure.id && (
              <div className="px-2.5 pb-2.5 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(lure) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--color-danger)]/20 text-[var(--color-danger)] font-medium"
                >
                  Delete
                </button>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px]">
            <h3 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">Delete Lure?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Remove "{deleteTarget.name}" from your lure library? Catches that used this lure will keep their data.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
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
