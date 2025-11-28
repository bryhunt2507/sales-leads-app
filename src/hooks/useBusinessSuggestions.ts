// src/hooks/useBusinessSuggestions.ts
import { useState } from 'react'
import { supabase } from '../supabaseClient'
import type { LatLng } from '../utils/geo'

export interface BusinessSuggestion {
  placeId?: string
  name: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  userRatingsTotal?: number
}

interface Result {
  suggestions: BusinessSuggestion[]
  loading: boolean
  error: string | null
  message: string | null
  // call this from the button, passing current coords
  search: (coords: LatLng | null) => Promise<void>
}

export function useBusinessSuggestions(): Result {
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function search(coords: LatLng | null) {
    setError(null)
    setMessage(null)

    if (!coords) {
      setMessage('Location not available yet.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        'get-suggested-businesses',
        {
          body: { lat: coords.lat, lon: coords.lng },
        },
      )

      if (error) throw error

      const list = (data || []) as BusinessSuggestion[]

      // keep it to the closest 5, just like the old app
      const top = list.slice(0, 5)

      setSuggestions(top)
      setMessage(
        top.length
          ? 'Tap a business below to prefill company / phone / website.'
          : 'No nearby businesses found.',
      )
    } catch (err) {
      console.error('Business suggestions error', err)
      setError('Could not load nearby businesses. Check location + API key.')
    } finally {
      setLoading(false)
    }
  }

  return { suggestions, loading, error, message, search }
}

export default useBusinessSuggestions
