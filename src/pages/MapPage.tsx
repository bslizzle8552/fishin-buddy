import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
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

const pinDropIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23e85050" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

function RecenterMap({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.5 })
  }, [lat, lng, zoom, map])
  return null
}

// Component to capture tap-to-place coordinates
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Component to track map center
function MapCenterTracker({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter()
      onCenterChange(c.lat, c.lng)
    },
  })
  return null
}

// Locate-me button as a Leaflet control
function LocateMeControl({ onLocate }: { onLocate: () => void }) {
  const map = useMap()
  useEffect(() => {
    const LocateControl = L.Control.extend({
      options: { position: 'bottomright' as const },
      onAdd() {
        const btn = L.DomUtil.create('button', '')
        btn.style.cssText = 'width:44px;height:44px;border-radius:12px;background:#242938;border:1px solid #3a3f52;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);padding:0;line-height:0;'
        btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a9e6e" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/></svg>'
        L.DomEvent.disableClickPropagation(btn)
        btn.addEventListener('click', onLocate)
        return btn
      },
    })
    const ctrl = new LocateControl()
    ctrl.addTo(map)
    return () => { ctrl.remove() }
  }, [map, onLocate])
  return null
}

export default function MapPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [waters, setWaters] = useState<Water[]>([])
  const [selectedWater, setSelectedWater] = useState<Water | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [spotCatchCounts, setSpotCatchCounts] = useState<Record<string, number>>({})
  const [center, setCenter] = useState<[number, number]>([39.5, -84.3])
  const [zoom, setZoom] = useState(14) // Start at street level — close enough to see where you are
  const [search, setSearch] = useState('')
  const [showAddWater, setShowAddWater] = useState(false)
  const [showAddSpot, setShowAddSpot] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  // Tap-to-place pin state
  const [placingPin, setPlacingPin] = useState<'water' | 'spot' | null>(null)
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 39.5, lng: -84.3 })

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'water' | 'spot'; id: string; name: string } | null>(null)

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

  const locateMe = useCallback(() => {
    getCurrentPosition()
      .then(pos => {
        setCenter([pos.coords.latitude, pos.coords.longitude])
        setZoom(16)
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
      .catch(() => {
        alert('Could not get your location. Make sure location services are enabled.')
      })
  }, [])

  useEffect(() => {
    loadWaters()
    // Center on user's GPS right away
    getCurrentPosition()
      .then(pos => {
        setCenter([pos.coords.latitude, pos.coords.longitude])
        setZoom(16) // Zoom in close so you can see where you are
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
      .catch(() => {})
  }, [loadWaters])

  useEffect(() => {
    if (selectedWater) {
      loadSpots(selectedWater.id)
      setCenter([selectedWater.latitude, selectedWater.longitude])
      setZoom(16)
    } else {
      setSpots([])
      setZoom(10)
    }
  }, [selectedWater, loadSpots])

  const startAddWater = () => {
    setPlacingPin('water')
    setPinnedLocation(null)
    setShowAddWater(true)
    setNewName('')
  }

  const startAddSpot = () => {
    setPlacingPin('spot')
    setPinnedLocation(null)
    setShowAddSpot(true)
    setNewName('')
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (placingPin) {
      setPinnedLocation({ lat, lng })
    }
  }

  const addWater = async () => {
    if (!newName.trim() || !user) return
    setLoading(true)
    // Use pinned location, or map center, or GPS as fallback
    const loc = pinnedLocation || mapCenter
    await supabase.from('waters').insert({
      user_id: user.id,
      name: newName.trim(),
      latitude: loc.lat,
      longitude: loc.lng,
    })
    setNewName('')
    setShowAddWater(false)
    setPlacingPin(null)
    setPinnedLocation(null)
    loadWaters()
    setLoading(false)
  }

  const addSpot = async () => {
    if (!newName.trim() || !user || !selectedWater) return
    setLoading(true)
    const loc = pinnedLocation || mapCenter
    await supabase.from('spots').insert({
      user_id: user.id,
      water_id: selectedWater.id,
      name: newName.trim(),
      latitude: loc.lat,
      longitude: loc.lng,
    })
    setNewName('')
    setShowAddSpot(false)
    setPlacingPin(null)
    setPinnedLocation(null)
    loadSpots(selectedWater.id)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'spot') {
      // Delete catches and skunk_logs for this spot first
      await supabase.from('catches').delete().eq('spot_id', deleteTarget.id)
      await supabase.from('skunk_logs').delete().eq('spot_id', deleteTarget.id)
      await supabase.from('spots').delete().eq('id', deleteTarget.id)
      if (selectedWater) loadSpots(selectedWater.id)
    } else {
      // Delete all spots (and their catches) under this water
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
      setSelectedWater(null)
      loadWaters()
    }
    setDeleteTarget(null)
  }

  const filteredWaters = search
    ? waters.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
    : waters

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar — with safe area top padding */}
      <div className="px-3 pb-2 bg-[var(--color-bg)] z-[1000] relative" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
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
            <div className="absolute top-full left-3 mt-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl z-[1001] p-1 min-w-[160px]">
              <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                {user?.email || 'Signed in'}
              </div>
              <button
                onClick={() => { setShowProfile(false); signOut() }}
                className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-danger)] rounded-lg"
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-h-48 overflow-y-auto z-[1001]">
                {filteredWaters.map(w => (
                  <button
                    key={w.id}
                    onClick={() => { setSelectedWater(w); setSearch('') }}
                    className="w-full text-left px-4 py-3 text-[var(--color-text)] border-b border-[var(--color-border)] last:border-b-0 active:bg-[var(--color-bg-input)]"
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
              onClick={() => setSelectedWater(null)}
              className="bg-[var(--color-bg-input)] text-[var(--color-text-muted)] px-3 rounded-xl border border-[var(--color-border)] text-sm whitespace-nowrap"
            >
              All Waters
            </button>
          ) : (
            <button
              onClick={startAddWater}
              className="bg-[var(--color-accent)] text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>
        {/* Water-level header with name + Add Spot + Delete */}
        {selectedWater && (
          <div className="flex items-center justify-between mt-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)] flex-1 truncate">
              {selectedWater.name}
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={startAddSpot}
                className="text-[var(--color-accent)] text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Spot
              </button>
              <button
                onClick={() => setDeleteTarget({ type: 'water', id: selectedWater.id, name: selectedWater.name })}
                className="text-[var(--color-danger)] text-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Spot count indicator when drilled in */}
        {selectedWater && (
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {spots.length} spot{spots.length !== 1 ? 's' : ''} — tap a pin to view history
          </div>
        )}
      </div>

      {/* Pin placement instruction banner */}
      {placingPin && (
        <div className="bg-[var(--color-accent)] text-white text-center py-2 text-sm font-medium z-[999]">
          Tap the map to place the pin, or it'll drop at map center
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
          />
          <RecenterMap lat={center[0]} lng={center[1]} zoom={zoom} />
          <MapCenterTracker onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
          <LocateMeControl onLocate={locateMe} />

          {/* Tap-to-place handler when in pin placement mode */}
          {placingPin && <MapClickHandler onMapClick={handleMapClick} />}

          {/* Tap-to-place preview pin */}
          {pinnedLocation && (
            <Marker position={[pinnedLocation.lat, pinnedLocation.lng]} icon={pinDropIcon}>
              <Popup>Pin here</Popup>
            </Marker>
          )}

          {/* Waters view */}
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

          {/* Spots view (drilled into a Water) */}
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
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'spot', id: s.id, name: s.name }) }}
                    className="text-xs text-red-400 mt-2 underline"
                  >
                    Delete spot
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Crosshair for map center when placing pin */}
        {placingPin && !pinnedLocation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="w-8 h-8 border-2 border-red-400 rounded-full opacity-60" />
            <div className="absolute w-0.5 h-4 bg-red-400 opacity-60" />
            <div className="absolute w-4 h-0.5 bg-red-400 opacity-60" />
          </div>
        )}

      </div>

      {/* Add Water — Step 1: pin is on map already, just need name */}
      {showAddWater && (
        <Modal onClose={() => { setShowAddWater(false); setPlacingPin(null); setPinnedLocation(null) }}>
          <h3 className="text-lg font-semibold mb-2">Name This Water</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">
            {pinnedLocation
              ? 'Pin placed! Now give it a name.'
              : 'Tap the map behind this panel to place the pin, or it drops at map center.'}
          </p>
          {pinnedLocation && (
            <div className="text-xs text-[var(--color-accent)] mb-2">
              📍 {pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)}
            </div>
          )}
          <input
            type="text"
            placeholder="e.g. Caesar Creek, Steve's Work Pond"
            value={newName}
            onChange={e => setNewName(e.target.value)}
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

      {/* Add Spot — Step 1: pin is on map already, just need name */}
      {showAddSpot && (
        <Modal onClose={() => { setShowAddSpot(false); setPlacingPin(null); setPinnedLocation(null) }}>
          <h3 className="text-lg font-semibold mb-2">Name This Spot</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">
            at {selectedWater?.name} — {pinnedLocation
              ? 'Pin placed! Now give it a name.'
              : 'Tap the map to place the pin first, or it drops at map center.'}
          </p>
          {pinnedLocation && (
            <div className="text-xs text-[var(--color-accent)] mb-2">
              📍 {pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)}
            </div>
          )}
          <input
            type="text"
            placeholder="e.g. Spillway, Dock Corner, Fallen Tree"
            value={newName}
            onChange={e => setNewName(e.target.value)}
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">
            Delete {deleteTarget.type === 'water' ? 'Water' : 'Spot'}?
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {deleteTarget.type === 'water'
              ? `Delete "${deleteTarget.name}" and all its spots and catch history? This can't be undone.`
              : `Delete "${deleteTarget.name}" and all its catch history? This can't be undone.`
            }
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text)] py-3 rounded-xl font-medium border border-[var(--color-border)]"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 bg-[var(--color-danger)] text-white py-3 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--color-bg-card)] rounded-t-2xl p-5 w-full max-w-[430px]">
        {children}
      </div>
    </div>
  )
}
