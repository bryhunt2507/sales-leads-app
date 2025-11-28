// src/services/leadService.ts
import { supabase } from '../supabaseClient'
import { distanceInMeters, type LatLng, GEOFENCE_RADIUS_M } from '../utils/geo'

export interface Lead {
  id: string
  org_id: string
  company: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  contact_title: string | null
  buying_role: string | null
  industry: string | null
  status: string | null
  rating: string | null
  latitude: number | null
  longitude: number | null
  call_history: any[] | null
  note_history?: any[] | null
}

export type NearbyLead = Lead & {
  distance_m: number
}

export async function fetchLeadsWithLocation(
  organizationId: string,
  limit = 10000,
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      id, org_id, company,
      contact_name, contact_email, contact_phone,
      website, contact_title, buying_role,
      industry, status, rating,
      latitude, longitude,
      call_history, note_history
    `,
    )
    .eq('org_id', organizationId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(limit)

  if (error) throw error
  return (data || []) as Lead[]
}

export function computeNearbyLeads(
  coords: LatLng,
  leads: Lead[],
  radiusM = GEOFENCE_RADIUS_M,
  maxResults = 5,
): NearbyLead[] {
  return leads
    .map((row): NearbyLead | null => {
      const lat =
        typeof row.latitude === 'number'
          ? row.latitude
          : Number(row.latitude)
      const lng =
        typeof row.longitude === 'number'
          ? row.longitude
          : Number(row.longitude)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null
      }

      const d = distanceInMeters(coords.lat, coords.lng, lat, lng)

      return {
        ...(row as Lead),
        latitude: lat,
        longitude: lng,
        distance_m: d,
      }
    })
    .filter((r): r is NearbyLead => r !== null && r.distance_m <= radiusM)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, maxResults)
}


export async function searchLeads(
  organizationId: string,
  term: string,
  limit = 25,
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      id, org_id, company,
      contact_name, contact_email, contact_phone,
      website, contact_title, buying_role,
      industry, status, rating,
      latitude, longitude,
      call_history, note_history
    `,
    )
    .eq('org_id', organizationId)
    .or(
      `company.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%,contact_phone.ilike.%${term}%`,
    )
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Lead[]
}

export async function insertLead(payload: Partial<Lead> & Record<string, any>) {
  const { error } = await supabase.from('leads').insert(payload)
  if (error) throw error
}

export async function updateLead(id: string, fields: Partial<Lead>) {
  const { error } = await supabase.from('leads').update(fields).eq('id', id)
  if (error) throw error
}
