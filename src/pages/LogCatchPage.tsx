import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { capturePhoto, compressAndUpload } from '../lib/photos'
import { getCurrentPosition, findNearestSpot } from '../lib/geo'
import { fetchWeather } from '../lib/weather'
import { SPECIES } from '../lib/species'
import type { Spot, Water, Lure, WeatherData } from '../types/database'

type Step = 'fish-photo' | 'lure' | 'species' | 'spot' | 'notes' | 'saving' | 'done'

export default function LogCatchPage() {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('fish-photo')

  // Catch data
  const [fishPhotoFile, setFishPhotoFile] = useState<File | null>(null)
  const [fishPhotoPreview, setFishPhotoPreview] = useState<string | null>(null)
  const [selectedLure, setSelectedLure] = useState<Lure | null>(null)
  const [newLureFile, setNewLureFile] = useState<File | null>(null)
  const [newLurePreview, setNewLurePreview] = useState<string | null>(null)
  const [newLureName, setNewLureName] = useState('')
  const [species, setSpecies] = useState('')
  const [customSpecies, setCustomSpecies] = useState('')
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [selectedWater, setSelectedWater] = useState<Water | null>(null)
  const [notes, setNotes] = useState('')
  const [sizeEstimate, setSizeEstimate] = useState('')

  // Lookups
  const [recentLures, setRecentLures] = useState<Lure[]>([])
  const [spots, setSpots] = useState<Spot[]>([])
  const [waters, setWaters] = useState<Water[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null)

  // Plus-one state
  const [lastCatch, setLastCatch] = useState<{
    spot_id: string
    water_id: string
    lure_id: string
    species: string
    weather: WeatherData | null
    lat: number
    lon: number
  } | null>(null)
  const [plusOneCount, setPlusOneCount] = useState(0)
  const [showSkunk, setShowSkunk] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    const [lureRes, waterRes, spotRes] = await Promise.all([
      supabase.from('lures').select('*').eq('user_id', user.id).order('catch_count', { ascending: false }).limit(20),
      supabase.from('waters').select('*').eq('user_id', user.id).order('name'),
      supabase.from('spots').select('*').eq('user_id', user.id).order('name'),
    ])
    if (lureRes.data) setRecentLures(lureRes.data)
    if (waterRes.data) setWaters(waterRes.data)
    if (spotRes.data) setSpots(spotRes.data)
    return { waters: waterRes.data, spots: spotRes.data }
  }, [user])

  useEffect(() => {
    loadData().then(async (result) => {
      // Get GPS and weather
      try {
        const pos = await getCurrentPosition()
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setGpsCoords(coords)
        // Auto-match nearest spot
        if (result?.spots) {
          const nearest = findNearestSpot(coords.lat, coords.lon, result.spots)
          if (nearest) {
            setSelectedSpot(nearest)
            const water = result.waters?.find((w: any) => w.id === nearest.water_id)
            if (water) setSelectedWater(water)
          }
        }
        // Fetch weather
        const w = await fetchWeather(coords.lat, coords.lon)
        setWeather(w)
      } catch {
        // GPS not available — weather and auto-match won't work
      }
    })
  }, [user, loadData])

  // When waters load and we have a matched spot, set the water
  useEffect(() => {
    if (selectedSpot && waters.length > 0 && !selectedWater) {
      const water = waters.find(w => w.id === selectedSpot.water_id)
      if (water) setSelectedWater(water)
    }
  }, [selectedSpot, waters, selectedWater])

  const handleFishPhoto = async () => {
    const file = await capturePhoto()
    if (file) {
      setFishPhotoFile(file)
      setFishPhotoPreview(URL.createObjectURL(file))
      setStep('lure')
    }
  }

  const handleNewLurePhoto = async () => {
    const file = await capturePhoto()
    if (file) {
      setNewLureFile(file)
      setNewLurePreview(URL.createObjectURL(file))
    }
  }

  const handleSelectLure = (lure: Lure) => {
    setSelectedLure(lure)
    setStep('species')
  }

  const handleConfirmNewLure = () => {
    if (newLureName.trim() && newLureFile) {
      setStep('species')
    }
  }

  const handleSelectSpecies = (s: string) => {
    if (s === 'Other') {
      setSpecies('Other')
    } else {
      setSpecies(s)
      setStep('spot')
    }
  }

  const handleConfirmCustomSpecies = () => {
    if (customSpecies.trim()) {
      setSpecies(customSpecies.trim())
      setStep('spot')
    }
  }

  const handleSave = async () => {
    if (!user || !gpsCoords) return
    setStep('saving')

    try {
      // Upload fish photo
      let fishPhotoUrl: string | null = null
      if (fishPhotoFile) {
        fishPhotoUrl = await compressAndUpload(fishPhotoFile, 'catch-photos', `fish/${user.id}`)
      }

      // Handle lure - either existing or new
      let lureId = selectedLure?.id
      if (!lureId && newLureFile && newLureName.trim()) {
        const lurePhotoUrl = await compressAndUpload(newLureFile, 'catch-photos', `lures/${user.id}`)
        if (lurePhotoUrl) {
          const { data: newLure } = await supabase
            .from('lures')
            .insert({
              user_id: user.id,
              name: newLureName.trim(),
              photo_url: lurePhotoUrl,
            })
            .select()
            .single()
          if (newLure) lureId = newLure.id
        }
      }

      if (!lureId || !selectedSpot || !selectedWater) {
        alert('Missing required info. Please select a lure and spot.')
        setStep('lure')
        return
      }

      // Create the catch
      const catchData = {
        user_id: user.id,
        spot_id: selectedSpot.id,
        water_id: selectedWater.id,
        lure_id: lureId,
        species: species,
        fish_photo_url: fishPhotoUrl,
        quantity: 1,
        notes: notes || null,
        size_estimate: sizeEstimate || null,
        temperature_f: weather?.temperature_f ?? null,
        cloud_cover: weather?.cloud_cover ?? null,
        wind_speed_mph: weather?.wind_speed_mph ?? null,
        wind_direction: weather?.wind_direction ?? null,
        barometric_pressure: weather?.barometric_pressure ?? null,
        precipitation: weather?.precipitation ?? null,
        latitude: gpsCoords.lat,
        longitude: gpsCoords.lon,
        caught_at: new Date().toISOString(),
      }

      await supabase.from('catches').insert(catchData)

      // Increment lure catch count
      await supabase.rpc('increment_lure_catch_count', { lure_id_param: lureId })

      // Store for plus-one
      setLastCatch({
        spot_id: selectedSpot.id,
        water_id: selectedWater.id,
        lure_id: lureId,
        species: species,
        weather: weather,
        lat: gpsCoords.lat,
        lon: gpsCoords.lon,
      })
      setPlusOneCount(0)

      setStep('done')
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save catch. Please try again.')
      setStep('notes')
    }
  }

  const handlePlusOne = async () => {
    if (!lastCatch || !user) return
    await supabase.from('catches').insert({
      user_id: user.id,
      spot_id: lastCatch.spot_id,
      water_id: lastCatch.water_id,
      lure_id: lastCatch.lure_id,
      species: lastCatch.species,
      fish_photo_url: null,
      quantity: 1,
      notes: null,
      size_estimate: null,
      temperature_f: lastCatch.weather?.temperature_f ?? null,
      cloud_cover: lastCatch.weather?.cloud_cover ?? null,
      wind_speed_mph: lastCatch.weather?.wind_speed_mph ?? null,
      wind_direction: lastCatch.weather?.wind_direction ?? null,
      barometric_pressure: lastCatch.weather?.barometric_pressure ?? null,
      precipitation: lastCatch.weather?.precipitation ?? null,
      latitude: lastCatch.lat,
      longitude: lastCatch.lon,
      caught_at: new Date().toISOString(),
    })
    await supabase.rpc('increment_lure_catch_count', { lure_id_param: lastCatch.lure_id })
    setPlusOneCount(prev => prev + 1)
  }

  const handleSkunkLog = async (skunkNotes: string, luresTried: string) => {
    if (!user || !selectedSpot || !selectedWater || !gpsCoords) return
    await supabase.from('skunk_logs').insert({
      user_id: user.id,
      spot_id: selectedSpot.id,
      water_id: selectedWater.id,
      notes: skunkNotes || null,
      lures_tried: luresTried || null,
      temperature_f: weather?.temperature_f ?? null,
      cloud_cover: weather?.cloud_cover ?? null,
      wind_speed_mph: weather?.wind_speed_mph ?? null,
      wind_direction: weather?.wind_direction ?? null,
      barometric_pressure: weather?.barometric_pressure ?? null,
      precipitation: weather?.precipitation ?? null,
      logged_at: new Date().toISOString(),
    })
    setShowSkunk(false)
    setStep('done')
    setLastCatch(null)
  }

  const reset = () => {
    setStep('fish-photo')
    setFishPhotoFile(null)
    setFishPhotoPreview(null)
    setSelectedLure(null)
    setNewLureFile(null)
    setNewLurePreview(null)
    setNewLureName('')
    setSpecies('')
    setCustomSpecies('')
    setNotes('')
    setSizeEstimate('')
    setLastCatch(null)
    setPlusOneCount(0)
  }

  // Skunk log modal
  if (showSkunk) {
    return <SkunkLogForm
      onSave={handleSkunkLog}
      onCancel={() => setShowSkunk(false)}
      spotName={selectedSpot?.name}
      waterName={selectedWater?.name}
    />
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] px-4 pb-4 overflow-y-auto" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
      {/* Weather bar */}
      {weather && weather.temperature_f && (
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] mb-4 bg-[var(--color-bg-card)] rounded-xl px-3 py-2">
          <span>{weather.temperature_f}°F</span>
          {weather.cloud_cover && <span>{weather.cloud_cover}</span>}
          {weather.wind_speed_mph != null && <span>{weather.wind_speed_mph}mph {weather.wind_direction}</span>}
          {weather.barometric_pressure && <span>{weather.barometric_pressure}"</span>}
        </div>
      )}

      {/* STEP: Fish Photo */}
      {step === 'fish-photo' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <button
            onClick={handleFishPhoto}
            className="w-40 h-40 rounded-2xl bg-[var(--color-bg-card)] border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <svg className="w-12 h-12 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <span className="text-[var(--color-text)] font-medium">Snap the Fish</span>
          </button>
          <p className="text-[var(--color-text-muted)] text-sm">Take a photo of your catch</p>

          {/* Skunk log option */}
          <button
            onClick={() => setShowSkunk(true)}
            className="text-[var(--color-text-muted)] text-sm underline mt-4"
          >
            Log a skunk (no catch)
          </button>

          {selectedSpot && (
            <div className="text-sm text-[var(--color-text-muted)]">
              📍 Near: {selectedSpot.name}
            </div>
          )}
        </div>
      )}

      {/* STEP: Lure Selection */}
      {step === 'lure' && (
        <div className="flex-1">
          {fishPhotoPreview && (
            <div className="mb-4 rounded-xl overflow-hidden h-32">
              <img src={fishPhotoPreview} alt="Catch" className="w-full h-full object-cover" />
            </div>
          )}
          <h3 className="text-lg font-semibold mb-3">What'd you throw?</h3>

          {/* Recent lures as visual grid */}
          {recentLures.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {recentLures.map(lure => (
                <button
                  key={lure.id}
                  onClick={() => handleSelectLure(lure)}
                  className="bg-[var(--color-bg-card)] rounded-xl p-2 active:scale-95 transition-transform border border-[var(--color-border)]"
                >
                  <img
                    src={lure.photo_url}
                    alt={lure.name}
                    className="w-full h-16 object-cover rounded-lg mb-1"
                  />
                  <div className="text-xs text-[var(--color-text)] truncate">{lure.name}</div>
                </button>
              ))}
            </div>
          )}

          {/* New lure */}
          <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
            <h4 className="text-sm font-medium mb-2 text-[var(--color-text-muted)]">New Lure</h4>
            {newLurePreview ? (
              <img src={newLurePreview} alt="New lure" className="w-full h-24 object-cover rounded-lg mb-2" />
            ) : (
              <button
                onClick={handleNewLurePhoto}
                className="w-full h-24 rounded-lg bg-[var(--color-bg-input)] border border-dashed border-[var(--color-border)] flex items-center justify-center mb-2"
              >
                <span className="text-[var(--color-text-muted)] text-sm">📷 Photo the lure</span>
              </button>
            )}
            <input
              type="text"
              placeholder="Name it (e.g. Green Senko, Red crankbait)"
              value={newLureName}
              onChange={e => setNewLureName(e.target.value)}
              className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-lg px-3 py-2 outline-none border border-[var(--color-border)] text-sm mb-2"
            />
            <button
              onClick={handleConfirmNewLure}
              disabled={!newLureName.trim() || !newLureFile}
              className="w-full bg-[var(--color-accent)] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Use This Lure
            </button>
          </div>
        </div>
      )}

      {/* STEP: Species */}
      {step === 'species' && (
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-3">What species?</h3>
          <div className="grid grid-cols-2 gap-2">
            {SPECIES.map(s => (
              <button
                key={s}
                onClick={() => handleSelectSpecies(s)}
                className={`bg-[var(--color-bg-card)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-medium border border-[var(--color-border)] active:scale-95 transition-transform ${
                  species === s ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : ''
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {species === 'Other' && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Enter species..."
                value={customSpecies}
                onChange={e => setCustomSpecies(e.target.value)}
                autoFocus
                className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)]"
              />
              <button
                onClick={handleConfirmCustomSpecies}
                disabled={!customSpecies.trim()}
                className="bg-[var(--color-accent)] text-white px-4 rounded-xl font-medium disabled:opacity-40"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: Spot selection */}
      {step === 'spot' && (
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-lg font-semibold mb-3">Where?</h3>
          {selectedSpot && (
            <div
              className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)] rounded-xl p-3 mb-3"
            >
              <div className="text-sm text-[var(--color-accent)] font-medium">
                {gpsCoords ? 'Auto-matched nearby' : 'Selected'}
              </div>
              <div className="text-[var(--color-text)] font-semibold">{selectedSpot.name}</div>
              {selectedWater && <div className="text-xs text-[var(--color-text-muted)]">{selectedWater.name}</div>}
            </div>
          )}

          {/* List all waters/spots for manual selection */}
          <div className="flex-1 overflow-y-auto -mx-4 px-4 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {waters.map(w => {
              const waterSpots = spots.filter(s => s.water_id === w.id)
              if (waterSpots.length === 0) return null
              return (
                <div key={w.id} className="mb-3">
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-1 mb-1.5">{w.name}</div>
                  {waterSpots.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onPointerDown={() => { setSelectedSpot(s); setSelectedWater(w) }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium mb-1.5 border transition-colors ${
                        selectedSpot?.id === s.id
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]'
                          : 'text-[var(--color-text)] bg-[var(--color-bg-card)] border-[var(--color-border)] active:bg-[var(--color-bg-input)]'
                      }`}
                    >
                      📍 {s.name}
                    </button>
                  ))}
                </div>
              )
            })}
            {waters.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">No waters or spots yet. Create some on the Map tab first.</p>
            )}
          </div>

          <button
            onClick={() => setStep('notes')}
            disabled={!selectedSpot}
            className="w-full bg-[var(--color-accent)] text-white py-3 rounded-xl font-medium mt-3 disabled:opacity-40 active:scale-[0.98] transition-transform shrink-0"
          >
            Continue
          </button>
        </div>
      )}

      {/* STEP: Notes (optional) */}
      {step === 'notes' && (
        <div className="flex-1 flex flex-col">
          <h3 className="text-lg font-semibold mb-3">Anything else? (optional)</h3>
          <input
            type="text"
            placeholder="Size estimate (e.g. 3 lbs, 14 inches)"
            value={sizeEstimate}
            onChange={e => setSizeEstimate(e.target.value)}
            className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] mb-3"
          />
          <textarea
            placeholder="Notes (retrieve style, water clarity, anything you want to remember)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] resize-none mb-4"
          />
          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => setStep('spot')}
              className="flex-1 bg-[var(--color-bg-card)] text-[var(--color-text)] py-3 rounded-xl font-medium border border-[var(--color-border)]"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-[var(--color-accent)] text-white py-3 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Save Catch
            </button>
          </div>
        </div>
      )}

      {/* STEP: Saving */}
      {step === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-muted)]">Saving your catch...</p>
        </div>
      )}

      {/* STEP: Done + Plus-One */}
      {step === 'done' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-5xl">🐟</div>
          <h3 className="text-xl font-bold text-[var(--color-text)]">
            {lastCatch ? 'Catch Logged!' : 'Skunk Logged'}
          </h3>
          {plusOneCount > 0 && (
            <div className="text-[var(--color-accent)] font-semibold text-lg">
              +{plusOneCount} more
            </div>
          )}

          {lastCatch && (
            <button
              onClick={handlePlusOne}
              className="w-32 h-32 rounded-full bg-[var(--color-accent)] text-white flex flex-col items-center justify-center shadow-xl active:scale-90 transition-transform"
            >
              <span className="text-4xl font-bold">+1</span>
              <span className="text-xs mt-1">Same lure & spot</span>
            </button>
          )}

          <button
            onClick={reset}
            className="text-[var(--color-text-muted)] text-sm underline mt-4"
          >
            Log a different catch
          </button>
        </div>
      )}
    </div>
  )
}

function SkunkLogForm({
  onSave,
  onCancel,
  spotName,
  waterName,
}: {
  onSave: (notes: string, luresTried: string) => void
  onCancel: () => void
  spotName?: string
  waterName?: string
}) {
  const [notes, setNotes] = useState('')
  const [luresTried, setLuresTried] = useState('')

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] px-4 pt-4 pb-4">
      <h3 className="text-xl font-bold mb-1">Skunk Log</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        No catch today{spotName ? ` at ${spotName}` : ''}{waterName ? ` (${waterName})` : ''} — log what you tried.
      </p>
      <input
        type="text"
        placeholder="What did you throw? (e.g. Senko, crankbait, jig)"
        value={luresTried}
        onChange={e => setLuresTried(e.target.value)}
        className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] mb-3"
      />
      <textarea
        placeholder="Notes (water clarity, conditions, anything you noticed)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={4}
        className="w-full bg-[var(--color-bg-input)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none border border-[var(--color-border)] resize-none mb-4"
      />
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onCancel}
          className="flex-1 bg-[var(--color-bg-card)] text-[var(--color-text)] py-3 rounded-xl font-medium border border-[var(--color-border)]"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(notes, luresTried)}
          className="flex-1 bg-[var(--color-warning)] text-gray-900 py-3 rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          Log Skunk
        </button>
      </div>
    </div>
  )
}
