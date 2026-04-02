import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Water, Spot } from '../types/database'

export default function ManagePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [waters, setWaters] = useState<Water[]>([])
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWater, setEditingWater] = useState<{ id: string; name: string } | null>(null)
  const [editingSpot, setEditingSpot] = useState<{ id: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'water' | 'spot'; id: string; name: string } | null>(null)
  const [expandedWater, setExpandedWater] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    const [wRes, sRes] = await Promise.all([
      supabase.from('waters').select('*').eq('user_id', user.id).order('name'),
      supabase.from('spots').select('*').eq('user_id', user.id).order('name'),
    ])
    if (wRes.data) setWaters(wRes.data)
    if (sRes.data) setSpots(sRes.data)
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const renameWater = async () => {
    if (!editingWater || !editingWater.name.trim()) return
    await supabase.from('waters').update({ name: editingWater.name.trim() }).eq('id', editingWater.id)
    setEditingWater(null)
    loadData()
  }

  const renameSpot = async () => {
    if (!editingSpot || !editingSpot.name.trim()) return
    await supabase.from('spots').update({ name: editingSpot.name.trim() }).eq('id', editingSpot.id)
    setEditingSpot(null)
    loadData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'spot') {
      await supabase.from('catches').delete().eq('spot_id', deleteTarget.id)
      await supabase.from('skunk_logs').delete().eq('spot_id', deleteTarget.id)
      await supabase.from('spots').delete().eq('id', deleteTarget.id)
    } else {
      const { data: waterSpots } = await supabase.from('spots').select('id').eq('water_id', deleteTarget.id)
      if (waterSpots) {
        for (const s of waterSpots) {
          await supabase.from('catches').delete().eq('spot_id', s.id)
          await supabase.from('skunk_logs').delete().eq('spot_id', s.id)
        }
        await supabase.from('spots').delete().eq('water_id', deleteTarget.id)
      }
      await supabase.from('catches').delete().eq('water_id', deleteTarget.id)
      await supabase.from('skunk_logs').delete().eq('water_id', deleteTarget.id)
      await supabase.from('waters').delete().eq('id', deleteTarget.id)
    }
    setDeleteTarget(null)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <h1 className="text-xl font-bold mb-4">My Waters & Spots</h1>

      {waters.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-[var(--color-text-muted)]">No waters yet. Add one from the Map tab or while logging a catch.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {waters.map(w => {
            const waterSpots = spots.filter(s => s.water_id === w.id)
            const isExpanded = expandedWater === w.id
            return (
              <div key={w.id} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                {/* Water header */}
                <div className="flex items-center p-3">
                  <button onClick={() => setExpandedWater(isExpanded ? null : w.id)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      {editingWater?.id === w.id ? (
                        <input type="text" value={editingWater.name}
                          onChange={e => setEditingWater({ ...editingWater, name: e.target.value })}
                          onBlur={renameWater} onKeyDown={e => e.key === 'Enter' && renameWater()}
                          autoFocus className="bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-lg px-2 py-1 text-sm outline-none border border-[var(--color-accent)]"
                          onClick={e => e.stopPropagation()} />
                      ) : (
                        <span className="font-semibold text-[var(--color-text)]">{w.name}</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] ml-6 mt-0.5">
                      {waterSpots.length} spot{waterSpots.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingWater({ id: w.id, name: w.name })}
                      className="p-2 text-[var(--color-text-muted)]" title="Rename">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteTarget({ type: 'water', id: w.id, name: w.name })}
                      className="p-2 text-[var(--color-danger)]" title="Delete">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Spots list */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] px-3 py-2">
                    {waterSpots.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] py-2">No spots at this water yet.</p>
                    ) : (
                      waterSpots.map(s => (
                        <div key={s.id} className="flex items-center py-2 border-b border-[var(--color-border)] last:border-b-0">
                          <div className="flex-1">
                            {editingSpot?.id === s.id ? (
                              <input type="text" value={editingSpot.name}
                                onChange={e => setEditingSpot({ ...editingSpot, name: e.target.value })}
                                onBlur={renameSpot} onKeyDown={e => e.key === 'Enter' && renameSpot()}
                                className="bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-lg px-2 py-1 text-sm outline-none border border-[var(--color-accent)]" />
                            ) : (
                              <span className="text-sm text-[var(--color-text)]">📍 {s.name}</span>
                            )}
                          </div>
                          <button onClick={() => navigate('/log', { state: { spotId: s.id, waterId: w.id } })}
                            className="px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded-lg mr-1 font-medium">
                            🐟 Log
                          </button>
                          <button onClick={() => setEditingSpot({ id: s.id, name: s.name })}
                            className="p-1.5 text-[var(--color-text-muted)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteTarget({ type: 'spot', id: s.id, name: s.name })}
                            className="p-1.5 text-[var(--color-danger)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px]">
            <h3 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">
              Delete {deleteTarget.type === 'water' ? 'Water' : 'Spot'}?
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {deleteTarget.type === 'water'
                ? `Delete "${deleteTarget.name}" and ALL its spots and catch history? This can't be undone.`
                : `Delete "${deleteTarget.name}" and all its catch history? This can't be undone.`}
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
