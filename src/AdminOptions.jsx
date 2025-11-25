// src/AdminOptions.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

function AdminOptions({
  organizationId,
  statusOptions,
  ratingOptions,
  industryOptions,
  reloadOptions,
}) {
  const [newStatus, setNewStatus] = useState('')
  const [newRating, setNewRating] = useState('')
  const [newIndustry, setNewIndustry] = useState('')

  const [savingStatus, setSavingStatus] = useState(false)
  const [savingRating, setSavingRating] = useState(false)
  const [savingIndustry, setSavingIndustry] = useState(false)

  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  if (!organizationId) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-2">Admin Settings</h2>
        <p className="helper">
          No organization is selected. Admin options are disabled.
        </p>
      </div>
    )
  }

  // Compute next sort_order based on the current list (which is already sorted)
  function nextSortOrder(list) {
    if (!Array.isArray(list) || list.length === 0) return 1
    const last = list[list.length - 1]
    const current = typeof last.sort_order === 'number' ? last.sort_order : 0
    return current + 1
  }

  // ---- ADD STATUS ----
  async function handleAddStatus(e) {
    e.preventDefault()
    if (!newStatus.trim()) return

    setSavingStatus(true)
    setMessage(null)
    setError(null)

    try {
      const sortOrder = nextSortOrder(statusOptions)

      const { error: insertError } = await supabase
        .from('call_status_options')
        .insert({
          organization_id: organizationId,
          label: newStatus.trim(),
          value: newStatus.trim(), // keep value = label for now
          sort_order: sortOrder,
          active: true,
        })

      if (insertError) throw insertError

      setNewStatus('')
      setMessage('Status added.')
      reloadOptions && reloadOptions(organizationId)
    } catch (err) {
      console.error('Add status error', err)
      setError(err.message || 'Error adding status.')
    } finally {
      setSavingStatus(false)
    }
  }

  // ---- ADD RATING ----
  async function handleAddRating(e) {
    e.preventDefault()
    if (!newRating.trim()) return

    setSavingRating(true)
    setMessage(null)
    setError(null)

    try {
      const sortOrder = nextSortOrder(ratingOptions)

      const { error: insertError } = await supabase
        .from('rating_options')
        .insert({
          organization_id: organizationId,
          label: newRating.trim(),
          value: newRating.trim(),
          sort_order: sortOrder,
          active: true,
        })

      if (insertError) throw insertError

      setNewRating('')
      setMessage('Rating added.')
      reloadOptions && reloadOptions(organizationId)
    } catch (err) {
      console.error('Add rating error', err)
      setError(err.message || 'Error adding rating.')
    } finally {
      setSavingRating(false)
    }
  }

  // ---- ADD INDUSTRY ----
  async function handleAddIndustry(e) {
    e.preventDefault()
    if (!newIndustry.trim()) return

    setSavingIndustry(true)
    setMessage(null)
    setError(null)

    try {
      const sortOrder = nextSortOrder(industryOptions)

      const { error: insertError } = await supabase
        .from('industry_options')
        .insert({
          organization_id: organizationId,
          label: newIndustry.trim(),
          value: newIndustry.trim(),
          sort_order: sortOrder,
          active: true,
        })

      if (insertError) throw insertError

      setNewIndustry('')
      setMessage('Industry added.')
      reloadOptions && reloadOptions(organizationId)
    } catch (err) {
      console.error('Add industry error', err)
      setError(err.message || 'Error adding industry.')
    } finally {
      setSavingIndustry(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Admin – Option Lists</h2>
      <p className="helper" style={{ marginBottom: 12 }}>
        Manage the dropdown options used in Sales Entry for this organization.
      </p>

      {/* STATUS OPTIONS */}
      <section style={{ marginBottom: 18 }}>
        <h3 className="section-title">Call Status Options</h3>
        <div className="section-divider" />

        <div className="helper" style={{ marginBottom: 6 }}>
          Current statuses:
          {(!statusOptions || statusOptions.length === 0) && ' (none yet)'}
        </div>
        {statusOptions && statusOptions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              paddingLeft: 0,
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            {statusOptions.map((opt) => (
              <li key={opt.id} style={{ marginBottom: 2 }}>
                • {opt.label}
                {!opt.active && (
                  <span style={{ color: '#b91c1c' }}> (inactive)</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAddStatus}
          style={{ marginTop: 8, display: 'flex', gap: 8 }}
        >
          <input
            type="text"
            placeholder="New status label"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />
          <button type="submit" disabled={savingStatus}>
            {savingStatus ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>

      {/* RATING OPTIONS */}
      <section style={{ marginBottom: 18 }}>
        <h3 className="section-title">Rating Options</h3>
        <div className="section-divider" />

        <div className="helper" style={{ marginBottom: 6 }}>
          Current ratings:
          {(!ratingOptions || ratingOptions.length === 0) && ' (none yet)'}
        </div>
        {ratingOptions && ratingOptions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              paddingLeft: 0,
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            {ratingOptions.map((opt) => (
              <li key={opt.id} style={{ marginBottom: 2 }}>
                • {opt.label}
                {!opt.active && (
                  <span style={{ color: '#b91c1c' }}> (inactive)</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAddRating}
          style={{ marginTop: 8, display: 'flex', gap: 8 }}
        >
          <input
            type="text"
            placeholder="New rating label"
            value={newRating}
            onChange={(e) => setNewRating(e.target.value)}
          />
          <button type="submit" disabled={savingRating}>
            {savingRating ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>

      {/* INDUSTRY OPTIONS */}
      <section style={{ marginBottom: 18 }}>
        <h3 className="section-title">Industry Options</h3>
        <div className="section-divider" />

        <div className="helper" style={{ marginBottom: 6 }}>
          Current industries:
          {(!industryOptions || industryOptions.length === 0) && ' (none yet)'}
        </div>
        {industryOptions && industryOptions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              paddingLeft: 0,
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            {industryOptions.map((opt) => (
              <li key={opt.id} style={{ marginBottom: 2 }}>
                • {opt.label}
                {!opt.active && (
                  <span style={{ color: '#b91c1c' }}> (inactive)</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAddIndustry}
          style={{ marginTop: 8, display: 'flex', gap: 8 }}
        >
          <input
            type="text"
            placeholder="New industry label"
            value={newIndustry}
            onChange={(e) => setNewIndustry(e.target.value)}
          />
          <button type="submit" disabled={savingIndustry}>
            {savingIndustry ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>

      {/* Messages */}
      {message && (
        <p style={{ marginTop: 8, fontSize: '0.9rem', color: '#166534' }}>
          {message}
        </p>
      )}
      {error && (
        <p style={{ marginTop: 4, fontSize: '0.9rem', color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default AdminOptions
