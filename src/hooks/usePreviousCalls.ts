// src/hooks/usePreviousCalls.ts
import { useState, useCallback } from 'react'
import type { LatLng } from '../utils/geo'
import {
  fetchLeadsWithLocation,
  computeNearbyLeads,
  type NearbyLead,
} from '../services/leadService'

export function usePreviousCalls(
  organizationId?: string,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nearby, setNearby] = useState<NearbyLead[]>([])
  const [debug, setDebug] = useState<any | null>(null)

  const load = useCallback(
    async (coords: LatLng | null) => {
      if (!organizationId || !coords) return

      setLoading(true)
      setError(null)

      try {
        const leads = await fetchLeadsWithLocation(organizationId, 10000)
        const nearbyLeads = computeNearbyLeads(coords, leads)

        setNearby(nearbyLeads)
        setDebug({
          coords,
          totalWithLatLng: leads.length,
          nearestSamples: nearbyLeads.map((r) => ({
            company: r.company,
            distance_m: r.distance_m,
            distance_ft: r.distance_m * 3.28084,
          })),
        })
      } catch (err: any) {
        console.error('usePreviousCalls error', err)
        setError(err.message ?? 'Error loading previous calls')
      } finally {
        setLoading(false)
      }
    },
    [organizationId],
  )

  return { loading, error, nearby, debug, load }
}
