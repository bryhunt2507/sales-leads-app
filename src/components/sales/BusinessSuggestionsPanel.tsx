// src/components/sales/BusinessSuggestionsPanel.tsx
import React from 'react'

interface BusinessSuggestion {
  placeId?: string
  name: string
  address?: string
  phone?: string
  rating?: number
  userRatingsTotal?: number
}

interface Props {
  suggestions: BusinessSuggestion[]
  message: string | null
  error: string | null
  onSelect: (biz: BusinessSuggestion) => void
}
export const BusinessSuggestionsPanel: React.FC<Props> = ({
  suggestions,
  message,
  error,
  onSelect,
}) => {
  if (!suggestions.length && !message && !error) return null

  return (
    <div className="card business-suggestions-panel" style={{ marginBottom: 10 }}>
      <div className="section-title">Nearby businesses</div>
      {error && (
        <p className="helper" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="helper" style={{ marginBottom: 4 }}>
          {message}
        </p>
      )}
      <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
        {suggestions.map((biz) => (
          <li
            key={biz.placeId || biz.name}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '6px 10px',
              marginBottom: 6,
              cursor: 'pointer',
            }}
            onClick={() => onSelect(biz)}
          >
            <div>
              <strong>{biz.name}</strong>
            </div>
            <div className="helper">
              {biz.address}
              {biz.phone && ` • ${biz.phone}`}
              {biz.rating && ` • ⭐ ${biz.rating} (${biz.userRatingsTotal})`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
} 
