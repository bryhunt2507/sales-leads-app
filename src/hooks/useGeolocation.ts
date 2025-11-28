// src/hooks/useGeolocation.ts
import { useEffect, useState, useCallback } from 'react'
import type { LatLng } from '../utils/geo'
export function useGeolocation(enabled = true) {
  const [coords, setCoords] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!enabled) return
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(next)
        setError(null)
      },
      (err) => {
        console.error('[GEO] error', err)
        setError('Unable to get your location.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [enabled])

  useEffect(() => {
    if (enabled) refresh()
  }, [enabled, refresh])

  return { coords, error, refresh }
}
