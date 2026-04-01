import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCurrentPosition } from '../lib/geo'
import type { Water, Spot } from '../types/database'
import { useNavigate } from 'react-router-dom'
import { getDataProgress } from '../lib/recommendations'

const waterIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234a9e6e" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const spotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d4a843" width="28" height="28"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`),
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
})

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

export default function MapPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [waters, setWaters] = useState<Water[]>([])
  const [selectedWater, setSelectedWater] = useState<Water | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [spotCatchCounts, setSpotCatchCounts] = useState<Record<string, number>>({})
  const [center, setCenter] = useState<[number, number]>([39.5, -84.3]) // SW Ohio default
  const [search, setSearch] = useState('')
  const [showAddWater, setShowAddWater] = useState(false)
  const [showAddSpot, setShowAddSpot] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  const loadWaters = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('waters')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (data) setWaters(data)
  }, [user])

  const loadSpots = useCallback(async (waterId: string) => {
    if (!user) return
    const { data } = await supabase
      .from('spots')
      .select('*')
      .eq('water_id', waterId)
      .eq('user_id', user.id)
      .order('name')
    if (data) {
      setSpots(data)
      // Load catch counts for each spot
      const counts: Record<string, number> = {}
      for (const spot of data) {
        const { count } = await supabase
          .from('catches')
          .select('*', { count: 'exact', head: true })
          .eq('spot_id', spot.id)
        counts[spot.id] = count || 0
      }
      setSpotCatchCounts(counts)
    }
  }, [user])

  useEffect(() => {
    loadWaters()
    // Try to center on user location
    getCurrentPosition()
      .then(pos => setCenter([pos.coords.latitude, pos.coords.longitude]))
      .catch(() => {})
  }, [loadWaters])

  useEffect(() => {
    if (selectedWater) {
      loadSpots(selectedWater.id)
      setCenter([selectedWater.latitude, selectedWater.longitude])
    }
  }, [selectedWater, loadSpots])

  const addWater = async () => {
    if (!newName.trim() || !user) return
    setLoading(true)
    try {
      const pos = await getCurrentPosition()
      await supabase.from('waters').insert({
        user_id: user.id,
        name: newName.trim(),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      setNewName('')
      setShowAddWater(false)
      loadWaters()
    } catch (err) {
      alert('Could not get GPS location. Make sure location is enabled.')
    }
    setLoading(false)
  }

  const addSpot = async () => {
    if (!newName.trim() || !user || !selectedWater) return
    setLoading(true)
    try {
      const pos = await getCurrentPosition()
      await supabase.from('spots').insert({
        user_id: user.id,
        water_id: selectedWater.id,
        name: newName.trim(),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      setNewName('')
      setShowAddSpot(false)
      loadSpots(selectedWater.id)
    } catch {
      alert('Could not get GPS location. Make sure location is enabled.')
    }
    setLoading(false)
  }

  const filteredWaters = search
    ? waters.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
    : waters

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-3 pt-3 pb-2 bg-[var(--color-bg)] z-[1000] relative">
        <div className="flex gap-2">
          {/* Profile button */}
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="w-10 h-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
              </svg>
            )}
          </button>
          {showProfile && (
            <div className="absolute top-14 left-3 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl z-30 p-1 min-w-[160px]">
              <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                {user?.email || 'Signed in'}
              </div>
              <button
                onClick={() => { setShowProfile(false); signOut() }}
                className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-danger)] rounded-lg hover:bg-[var(--color-bg-input)]"
              >
                Sign Out
              </button>
            </div>
          )}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search waters & spots..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] rounded-xl px-4 py-2.5 outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]"
            />
            {search && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-h-48 overflow-y-auto z-20">
                {filteredWaters.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWater(w)
                      setSearch('')
                    }}
                    className="w-full text-left px-4 py-3 text-[var(--color-text)] hover:bg-[var(--color-bg-input)] border-b border-[var(--color-border)] last:border-b-0"
                  >
                    {w.name}
                  </button>
                ))}
                {filteredWaters.length === 0 && (
                  <div className="px-4 py-3 text-[var(--color-text-muted)]">No results</div>
                )}
              </div>
            )}
          </div>
          {selectedWater ? (
            <button
              onClick={() => { setSelectedWater(null); setSpots([]) }}
              className="bg-[var(--color-bg-input)] text-[var(--color-text-muted)] px-3 rounded-xl border border-[var(--color-border)] text-sm whitespace-nowrap"
            >
              All Waters
            </button>
          ) : (
            <button
              onClick={() => setShowAddWater(true)}
              className="bg-[var(--color-accent)] text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>
        {selectedWater && (
          <div className="flex items-center justify-between mt-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {selectedWater.name}
            </h2>
            <button
              onClick={() => setShowAddSpot(true)}
              className="text-[var(--color-accent)] text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Spot
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={selectedWater ? 15 : 10}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
          />
          <RecenterMap lat={center[0]} lng={center[1]} />

          {!selectedWater && waters.map(w => (
            <Marker
              key={w.id}
              position={[w.latitude, w.longitude]}
              icon={waterIcon}
              eventHandlers={{
                click: () => setSelectedWater(w),
              }}
            >
              <Popup>
                <div className="text-sm font-medium">{w.name}</div>
              </Popup>
            </Marker>
          ))}

          {selectedWater && spots.map(s => (
            <Marker
              key={s.id}
              position={[s.latitude, s.longitude]}
              icon={spotIcon}
              eventHandlers={{
                click: () => navigate(`/spot/${s.id}`),
              }}
            >
              <Popup>
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-gray-400">
                    {spotCatchCounts[s.id] || 0} catches
                  </div>
                  {getDataProgress(spotCatchCounts[s.id] || 0) && (
                    <div className="text-xs text-amber-400 mt-1">
                      {getDataProgress(spotCatchCounts[s.id] || 0)}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Add Water Modal */}
      {showAddWater && (
        <Modal onClose={() => setShowAddWater(false)}>
          <h3 className="text-lg font-semibold mb-4">New Water</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Name this body of water. Your current GPS location will be pinned.
          </p>
          <input
            type="text"
            placeholder="e.g. Caesar Creek, Steve's Work Pond"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)] mb-4"
          />
          <button
            onClick={addWater}
            disabled={!newName.trim() || loading}
            className="w-full bg-[var(--color-accent)] text-white py-3 rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Pinning...' : 'Pin Water'}
          </button>
        </Modal>
      )}

      {/* Add Spot Modal */}
      {showAddSpot && (
        <Modal onClose={() => setShowAddSpot(false)}>
          <h3 className="text-lg font-semibold mb-4">New Spot at {selectedWater?.name}</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Name this spot. Your current GPS position will be pinned.
          </p>
          <input
            type="text"
            placeholder="e.g. Spillway, Dock Corner, Fallen Tree"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)] mb-4"
          />
          <button
            onClick={addSpot}
            disabled={!newName.trim() || loading}
            className="w-full bg-[var(--color-accent)] text-white py-3 rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Pinning...' : 'Pin Spot'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px] animate-slide-up">
        {children}
      </div>
    </div>
  )
}
