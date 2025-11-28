// src/components/sales/PreviousCallsModal.tsx
import React from 'react'
import type { NearbyLead, Lead } from '../../services/leadService'
import { metersToFeet } from '../../utils/geo'

interface Props {
  open: boolean
  onClose: () => void
  nearby: NearbyLead[]
  loadingNearby: boolean
  nearbyError: string | null
  // search
  searchTerm: string
  setSearchTerm: (val: string) => void
  searchLoading: boolean
  searchError: string | null
  searchResults: Lead[]
  onSearchSubmit: (e: React.FormEvent) => void
  onPickLead: (lead: Lead | NearbyLead) => void
}

export const PreviousCallsModal: React.FC<Props> = ({
  open,
  onClose,
  nearby,
  loadingNearby,
  nearbyError,
  searchTerm,
  setSearchTerm,
  searchLoading,
  searchError,
  searchResults,
  onSearchSubmit,
  onPickLead,
}) => {
  if (!open) return null

  const formatDistance = (meters?: number) =>
    meters == null ? '' : `${Math.round(metersToFeet(meters))} ft`

  const lastCallSummary = (call_history: any[] | null | undefined) => {
    if (!Array.isArray(call_history) || call_history.length === 0) return ''
    const last = call_history[call_history.length - 1]
    const date = last.date || last.timestamp || last.ts || last.created_at || null
    const stat = last.status || last.callType || last.type || ''
    const r = last.rating || ''
    const parts: string[] = []
    if (date) parts.push(date)
    if (stat) parts.push(stat)
    if (r) parts.push(`(${r})`)
    return parts.join(' • ')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '40px 12px 12px',
      }}
    >
      <div className="card" style={{ maxWidth: 720, width: '100%', maxHeight: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Select Previous Call</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ minHeight: 32, paddingInline: 10, background: '#0f172a' }}
          >
            Close
          </button>
        </div>

        <div className="section-title">Nearby (within ~300 ft)</div>
        <div className="section-divider" />

        {loadingNearby && <p className="helper">Loading nearby calls…</p>}
        {nearbyError && (
          <p className="helper" style={{ color: '#b91c1c' }}>
            {nearbyError}
          </p>
        )}
        {!loadingNearby && !nearbyError && nearby.length === 0 && (
          <p className="helper">No previous calls found near your current location.</p>
        )}

        {!loadingNearby && nearby.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nearby.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className="lead-card"
                style={{ textAlign: 'left' }}
                onClick={() => onPickLead(lead)}
              >
                <div style={{ fontWeight: 700 }}>
                  {lead.company || '(No company)'}{' '}
                  <span style={{ fontWeight: 400, color: '#6b7280' }}>
                    • {formatDistance(lead.distance_m)}
                  </span>
                </div>
                {(lead.contact_name || lead.contact_phone || lead.contact_email) && (
                  <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                    {lead.contact_name && <span>{lead.contact_name}</span>}
                    {lead.contact_phone && <span> • {lead.contact_phone}</span>}
                    {lead.contact_email && <span> • {lead.contact_email}</span>}
                  </div>
                )}
                {lead.call_history && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                    {lastCallSummary(lead.call_history)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search section */}
        <div className="section-title" style={{ marginTop: 16 }}>
          Search by name, email, phone
        </div>
        <div className="section-divider" />

        <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search company, contact, email, or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" disabled={searchLoading || !searchTerm.trim()}>
            {searchLoading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && (
          <p className="helper" style={{ color: '#b91c1c' }}>
            {searchError}
          </p>
        )}

        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {searchResults.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className="lead-card"
                style={{ textAlign: 'left' }}
                onClick={() => onPickLead(lead)}
              >
                <div style={{ fontWeight: 700 }}>{lead.company || '(No company)'}</div>
                {(lead.contact_name || lead.contact_phone || lead.contact_email) && (
                  <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                    {lead.contact_name && <span>{lead.contact_name}</span>}
                    {lead.contact_phone && <span> • {lead.contact_phone}</span>}
                    {lead.contact_email && <span> • {lead.contact_email}</span>}
                  </div>
                )}
                {lead.call_history && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                    {lastCallSummary(lead.call_history)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
