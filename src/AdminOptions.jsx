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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [newStatus, setNewStatus] = useState('')
  const [newRating, setNewRating] = useState('')
  const [newIndustry, setNewIndustry] = useState('')

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

  function safeReload() {
    try {
      if (reloadOptions) {
        // handle both signatures: reloadOptions() or reloadOptions(orgId)
        reloadOptions(organizationId)
      }
    } catch (e) {
      console.warn('reloadOptions error (non-fatal):', e)
    }
  }

  function nextSortOrder(list) {
    if (!Array.isArray(list) || list.length === 0) return 1
    const last = list[list.length - 1]
    return (typeof last.sort_order === 'number' ? last.sort_order : 0) + 1
  }

  async function handleAdd(tableName, label, listSetter) {
    if (!label.trim()) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      let baseList
      if (tableName === 'call_status_options') baseList = statusOptions
      else if (tableName === 'rating_options') baseList = ratingOptions
      else if (tableName === 'industry_options') baseList = industryOptions
      else baseList = []

      const sortOrder = nextSortOrder(baseList)

      const { error: insertError } = await supabase.from(tableName).insert({
        organization_id: organizationId,
        label: label.trim(),
        value: label.trim(),
        sort_order: sortOrder,
        active: true,
      })

      if (insertError) throw insertError

      listSetter('')
      setMessage('Option added.')
      safeReload()
    } catch (err) {
      console.error('Add option error', err)
      setError(err.message || 'Error adding option.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateLabel(tableName, optionId, newLabel) {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const { error: updError } = await supabase
        .from(tableName)
        .update({
          label: newLabel.trim(),
          value: newLabel.trim(),
        })
        .eq('id', optionId)
        .eq('organization_id', organizationId)

      if (updError) throw updError
      setMessage('Label updated.')
      safeReload()
    } catch (err) {
      console.error('Update label error', err)
      setError(err.message || 'Error updating label.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(tableName, optionId, active) {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const { error: updError } = await supabase
        .from(tableName)
        .update({ active })
        .eq('id', optionId)
        .eq('organization_id', organizationId)

      if (updError) throw updError
      setMessage(active ? 'Option activated.' : 'Option deactivated.')
      safeReload()
    } catch (err) {
      console.error('Toggle active error', err)
      setError(err.message || 'Error updating active flag.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove(tableName, list, index, direction) {
    const targetIndex = index + direction
    if (!list || targetIndex < 0 || targetIndex >= list.length) return

    const current = list[index]
    const target = list[targetIndex]
    if (!current || !target) return

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      // swap sort_order between current and target
      const { error: err1 } = await supabase
        .from(tableName)
        .update({ sort_order: target.sort_order })
        .eq('id', current.id)
        .eq('organization_id', organizationId)

      if (err1) throw err1

      const { error: err2 } = await supabase
        .from(tableName)
        .update({ sort_order: current.sort_order })
        .eq('id', target.id)
        .eq('organization_id', organizationId)

      if (err2) throw err2

      setMessage('Order updated.')
      safeReload()
    } catch (err) {
      console.error('Move option error', err)
      setError(err.message || 'Error changing order.')
    } finally {
      setSaving(false)
    }
  }

  function renderOptionList({
    title,
    tableName,
    options,
    newLabel,
    setNewLabel,
  }) {
    const hasOptions = options && options.length > 0

    return (
      <section style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ marginBottom: 4 }}>
          {title}
        </h3>
        <div className="section-divider" />

        <div className="helper" style={{ marginBottom: 6 }}>
          Current {title.toLowerCase()}:
          {!hasOptions && ' (none yet)'}
        </div>

        {hasOptions && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 8,
              maxHeight: 260,
              overflowY: 'auto',
              background: '#f9fafb',
              marginBottom: 8,
            }}
          >
            {options.map((opt, idx) => (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    width: 22,
                    textAlign: 'right',
                    color: '#6b7280',
                  }}
                >
                  {opt.sort_order ?? idx + 1}
                </span>
                <input
                  type="text"
                  value={opt.label || ''}
                  onChange={(e) =>
                    handleUpdateLabel(tableName, opt.id, e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => handleMove(tableName, options, idx, -1)}
                  disabled={idx === 0 || saving}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(tableName, options, idx, +1)}
                  disabled={idx === options.length - 1 || saving}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleActive(tableName, opt.id, !opt.active)
                  }
                  style={{
                    background: opt.active ? '#dc2626' : '#16a34a',
                    minWidth: 70,
                  }}
                  disabled={saving}
                >
                  {opt.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new option */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAdd(tableName, newLabel, setNewLabel)
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            type="text"
            placeholder={`New ${title.toLowerCase()} label`}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Admin – Option Lists</h2>
      <p className="helper" style={{ marginBottom: 12 }}>
        Manage the dropdown options used in Sales Entry for this organization.
        You can edit labels, change order, or disable options instead of
        deleting them.
      </p>

      {renderOptionList({
        title: 'Call Status Options',
        tableName: 'call_status_options',
        options: statusOptions,
        newLabel: newStatus,
        setNewLabel: setNewStatus,
      })}

      {renderOptionList({
        title: 'Rating Options',
        tableName: 'rating_options',
        options: ratingOptions,
        newLabel: newRating,
        setNewLabel: setNewRating,
      })}

      {renderOptionList({
        title: 'Industry Options',
        tableName: 'industry_options',
        options: industryOptions,
        newLabel: newIndustry,
        setNewLabel: setNewIndustry,
      })}

      {message && (
        <p
          style={{
            marginTop: 8,
            fontSize: '0.9rem',
            color: '#166534',
          }}
        >
          {message}
        </p>
      )}
      {error && (
        <p
          style={{
            marginTop: 4,
            fontSize: '0.9rem',
            color: '#b91c1c',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default AdminOptions
