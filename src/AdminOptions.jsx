import { useState } from 'react'
import { supabase } from './supabaseClient'

function AdminOptions({
  organizationId,
  statusOptions,
  ratingOptions,
  industryOptions,
  buyingRoleOptions,
  callTypeOptions,
  reloadOptions,
}) {
  const [newStatus, setNewStatus] = useState('')
  const [newRating, setNewRating] = useState('')
  const [newIndustry, setNewIndustry] = useState('')
  const [newBuyingRole, setNewBuyingRole] = useState('')
  const [newCallType, setNewCallType] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Create user states
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('user')

  // For inline editing
  const [editing, setEditing] = useState({
    type: null, // 'status' | 'rating' | 'industry'
    id: null,
    value: '',
  })

  function startEdit(type, option) {
    setEditing({
      type,
      id: option.id,
      value: option.label,
    })
  }

  function cancelEdit() {
    setEditing({ type: null, id: null, value: '' })
  }

  async function saveEdit(table) {
    if (!editing.value.trim() || !editing.id) return

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from(table)
      .update({ label: editing.value.trim() })
      .eq('id', editing.id)

    if (error) {
      console.error(error)
      setMessage('Error saving changes.')
    } else {
      setMessage('Changes saved.')
      cancelEdit()
      reloadOptions && reloadOptions()
    }

    setSaving(false)
  }

  async function deactivateOption(table, id) {
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from(table)
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error(error)
      setMessage('Error deactivating option.')
    } else {
      setMessage('Option deactivated.')
      reloadOptions && reloadOptions()
    }

    setSaving(false)
  }

  // Move option up/down by swapping sort_order with neighbor
  async function moveOption(table, list, option, direction) {
    if (!list || list.length === 0) return

    const idx = list.findIndex(o => o.id === option.id)
    if (idx === -1) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= list.length) return

    const neighbor = list[targetIdx]

    setSaving(true)
    setMessage(null)

    const currentOrder = option.sort_order ?? idx
    const neighborOrder = neighbor.sort_order ?? targetIdx

    // Swap the sort_order values
    const [res1, res2] = await Promise.all([
      supabase
        .from(table)
        .update({ sort_order: neighborOrder })
        .eq('id', option.id),
      supabase
        .from(table)
        .update({ sort_order: currentOrder })
        .eq('id', neighbor.id),
    ])

    if (res1.error || res2.error) {
      console.error(res1.error || res2.error)
      setMessage('Error reordering options.')
    } else {
      setMessage('Order updated.')
      reloadOptions && reloadOptions()
    }

    setSaving(false)
  }

  // Add new option, giving it the next sort_order
  async function addOption(table, label, clearFn, existingList) {
    if (!label.trim()) return

    setSaving(true)
    setMessage(null)

    let nextOrder = 1
    if (existingList && existingList.length > 0) {
      const max = existingList.reduce(
        (acc, o) =>
          o.sort_order != null && o.sort_order > acc ? o.sort_order : acc,
        0
      )
      nextOrder = max + 1
    }

    const { error } = await supabase.from(table).insert([
      {
        organization_id: organizationId,
        label: label.trim(),
        sort_order: nextOrder,
      },
    ])

    if (error) {
      console.error(error)
      setMessage('Error saving option.')
    } else {
      clearFn('')
      setMessage('Option added.')
      reloadOptions && reloadOptions()
    }

    setSaving(false)
  }

  // Create user and send magic sign-in link (passwordless)
  async function createUserAndSendLink() {
    if (!newUserEmail || !newUserEmail.includes('@')) {
      setMessage('Please enter a valid email address.')
      return
    }

    setSaving(true)
    setMessage(null)

    // Send magic link / OTP to email
    const { data, error: authError } = await supabase.auth.signInWithOtp({
      email: newUserEmail,
    })

    // Upsert profile with role (will create or update a profiles row keyed by email)
    const { error: profileError } = await supabase.from('profiles').upsert(
      [
        {
          email: newUserEmail,
          role: newUserRole,
          organization_id: organizationId,
        },
      ],
      { returning: 'minimal' }
    )

    if (authError) {
      console.error(authError)
      setMessage('Error sending sign-in link: ' + authError.message)
    } else if (profileError) {
      console.error(profileError)
      setMessage('Sign-in link sent, but error saving profile.')
    } else {
      setMessage('Sign-in link sent. User profile saved.')
      setNewUserEmail('')
      setNewUserRole('user')
      reloadOptions && reloadOptions()
    }

    setSaving(false)
  }

  function renderList(title, type, table, list, newValue, setNewValue) {
    return (
      <>
        <div
          className="section-title"
          style={title === 'Call Status Options' ? undefined : { marginTop: 24 }}
        >
          {title}
        </div>
        <div className="section-divider" />
        <ul style={{ paddingLeft: 0, listStyle: 'none', marginTop: 4 }}>
          {list.map((opt, index) => {
            const isEditing = editing.type === type && editing.id === opt.id
            return (
              <li
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '4px 0',
                }}
              >
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <input
                      value={editing.value}
                      onChange={e =>
                        setEditing(prev => ({
                          ...prev,
                          value: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <span>{opt.label}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {/* Move up/down */}
                  <button
                    type="button"
                    disabled={saving || index === 0}
                    onClick={() => moveOption(table, list, opt, 'up')}
                    style={{
                      minHeight: 0,
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={saving || index === list.length - 1}
                    onClick={() => moveOption(table, list, opt, 'down')}
                    style={{
                      minHeight: 0,
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                    }}
                  >
                    ↓
                  </button>

                  {/* Edit / Save */}
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveEdit(table)}
                        style={{
                          minHeight: 0,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={cancelEdit}
                        style={{
                          minHeight: 0,
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startEdit(type, opt)}
                      style={{
                        minHeight: 0,
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                      }}
                    >
                      Edit
                    </button>
                  )}

                  {/* Deactivate */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => deactivateOption(table, opt.id)}
                    style={{
                      minHeight: 0,
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      background: '#b91c1c',
                    }}
                  >
                    X
                  </button>
                </div>
              </li>
            )
          })}
          {list.length === 0 && <li>No options yet.</li>}
        </ul>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            placeholder={`Add new ${type}`}
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => addOption(table, newValue, setNewValue, list)}
          >
            Add
          </button>
        </div>
      </>
    )
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>
        Admin – Dropdown Options
      </h2>
      <p className="helper">
        Manage call status, rating, and industry options for this organization.
        Changes show up instantly in the Sales Entry form.
      </p>

      {renderList(
        'Call Status Options',
        'status',
        'call_status_options',
        statusOptions,
        newStatus,
        setNewStatus
      )}

      {renderList(
        'Rating Options',
        'rating',
        'rating_options',
        ratingOptions,
        newRating,
        setNewRating
      )}

      {renderList(
        'Industry Options',
        'industry',
        'industry_options',
        industryOptions,
        newIndustry,
        setNewIndustry
      )}

      {renderList(
        'Buying Role Options',
        'buying_role',
        'buying_role_options',
        buyingRoleOptions,
        newBuyingRole,
        setNewBuyingRole
      )}

      {renderList(
        'Call Type Options',
        'call_type',
        'call_type_options',
        callTypeOptions,
        newCallType,
        setNewCallType
      )}

      <div style={{ marginTop: 32 }}>
        <div className="section-title">Create User & Send Sign-in Link</div>
        <div className="section-divider" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input
            placeholder="user@example.com"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" disabled={saving} onClick={createUserAndSendLink}>
            Create & Send Link
          </button>
        </div>
        <p className="helper" style={{ marginTop: 8 }}>
          This will send a passwordless sign-in link to the email and save the
          selected role in the `profiles` table.
        </p>
      </div>

      {message && (
        <p style={{ marginTop: 12, fontSize: '0.9rem' }}>{message}</p>
      )}
    </div>
  )
}

export default AdminOptions
