import { useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function getBrowserLocation() {
  if (!('geolocation' in navigator)) return Promise.resolve(null)

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

export function useBusinessSuggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const search = useCallback(async () => {
    setError(null)
    setMessage(null)

    const coords = await getBrowserLocation()
    if (!coords) {
      setMessage('Location not available yet.')
      return
    }

    setLoading(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'get-suggested-businesses',
        { body: { lat: coords.lat, lon: coords.lng } },
      )
      if (fnError) throw fnError

      const list = data || []
      setSuggestions(list)

      setMessage(
        list.length
          ? 'Tap a business below to prefill company / phone / website.'
          : 'No nearby businesses found.',
      )
    } catch (e) {
      console.error('[BIZ] Edge function error', e)
      setError('Could not load nearby businesses.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { suggestions, loading, error, message, search }
}
