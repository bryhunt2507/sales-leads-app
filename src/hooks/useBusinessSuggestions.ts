// src/hooks/useBusinessSuggestions.ts
import { useState, useCallback } from 'react'
import type { LatLng } from '../utils/geo'
import { supabase } from '../supabaseClient'

export interface BusinessSuggestion {
  name: string
  address?: string
  phone?: string
  rating?: number
  userRatingsTotal?: number
  website?: string
  placeId?: string
}

interface State {
  suggestions: BusinessSuggestion[]
  loading: boolean
  error: string | null
  message: string | null
}

export function useBusinessSuggestions() {
  const [state, setState] = useState<State>({
    suggestions: [],
    loading: false,
    error: null,
    message: null,
  })

  const load = useCallback(async (coords: LatLng | null) => {
    if (!coords) {
      setState((s) => ({
        ...s,
        suggestions: [],
        message: 'Location not available yet.',
      }))
      return
    }

    setState((s) => ({ ...s, loading: true, error: null, message: null }))

    try {
      const { data, error } = await supabase.functions.invoke(
        'get-suggested-businesses',
        {
          body: { lat: coords.lat, lon: coords.lng },
        },
      )

      if (error) throw error

      const suggestions = (data || []) as BusinessSuggestion[]
      setState((s) => ({
        ...s,
        suggestions,
        message:
          suggestions.length === 0
            ? 'No nearby businesses found.'
            : 'Tap a business below to prefill company / phone / website.',
      }))
    } catch (err: any) {
      console.error('Business suggestions error', err)
      setState((s) => ({
        ...s,
        error:
          err.message ??
          'Could not load nearby businesses. Check location + API key.',
      }))
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  return { ...state, load }
}
