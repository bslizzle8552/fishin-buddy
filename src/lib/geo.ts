export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    })
  })
}

// Haversine distance in meters
export function distanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Find nearest spot within a threshold (default 200m)
export function findNearestSpot<T extends { latitude: number; longitude: number }>(
  lat: number,
  lon: number,
  spots: T[],
  thresholdMeters = 200
): T | null {
  let nearest: T | null = null
  let minDist = Infinity

  for (const spot of spots) {
    const d = distanceMeters(lat, lon, spot.latitude, spot.longitude)
    if (d < minDist && d <= thresholdMeters) {
      minDist = d
      nearest = spot
    }
  }

  return nearest
}
