// src/SalesEntryForm.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

// ~300 feet in meters
const GEOFENCE_RADIUS_M = 91.44

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000 // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Props:
 * - organizationId: uuid
 * - currentUserId: uuid (auth.user.id)
 * - statusOptions, ratingOptions, industryOptions, buyingRoleOptions, callTypeOptions: rows from option tables
 * - commonNoteOptions (optional): [{ id, label, value }]
 */
function SalesEntryForm({
  organizationId,
  currentUserId,
  statusOptions,
  ratingOptions,
  industryOptions,
  buyingRoleOptions,
  callTypeOptions,
  commonNoteOptions = [],
}) {
  // ---- GEO / PREVIOUS CALLS ----
  const [geofenceEnabled, setGeofenceEnabled] = useState(true)
  const [coords, setCoords] = useState(null) // { lat, lng }
  const [geoError, setGeoError] = useState(null)

  const [showPreviousCalls, setShowPreviousCalls] = useState(false)
  const [loadingPreviousCalls, setLoadingPreviousCalls] = useState(false)
  const [previousCalls, setPreviousCalls] = useState([]) // up to 5
  const [previousCallsError, setPreviousCallsError] = useState(null)

  const [loadingSuggested, setLoadingSuggested] = useState(false)
  const [suggestedMessage, setSuggestedMessage] = useState(null)

  // ---- FORM FIELDS ----
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [buyingRole, setBuyingRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState('')
  const [callType, setCallType] = useState('')
  const [note, setNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [selectedCommonNote, setSelectedCommonNote] = useState('')

  const [imageFile, setImageFile] = useState(null)
  const [imageLabel, setImageLabel] = useState('') // simple “Card selected” text

  const [selectedLead, setSelectedLead] = useState(null) // { id, ... }

  // ---- SUBMIT STATE ----
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  // ========== GEOLOCATION ==========
  useEffect(() => {
    if (!geofenceEnabled) return
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setGeoError(null)
      },
      (err) => {
        console.error('Geolocation error', err)
        setGeoError('Unable to get your location.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    )
  }, [geofenceEnabled])

  // ========== LOAD PREVIOUS CALLS (NEARBY) ==========
  const loadPreviousCalls = useCallback(async () => {
    if (!organizationId) return
    if (!coords) {
      setPreviousCallsError('Location not available yet.')
      setShowPreviousCalls(true)
      return
    }

    setShowPreviousCalls(true)
    setLoadingPreviousCalls(true)
    setPreviousCallsError(null)

    try {
      const { data, error } = await supabase
        .from('leads')
        .select(
          `
          id,
          company,
          contact_name,
          contact_email,
          contact_phone,
          status,
          rating,
          industry,
          latitude,
          longitude,
          call_history
        `,
        )
        .eq('org_id', organizationId)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(250)

      if (error) throw error

      const withDistance = (data || [])
        .map((row) => {
          if (
            typeof row.latitude !== 'number' ||
            typeof row.longitude !== 'number'
          ) {
            return null
          }
          const d = distanceInMeters(
            coords.lat,
            coords.lng,
            row.latitude,
            row.longitude,
          )
          return { ...row, distance_m: d }
        })
        .filter((r) => r && r.distance_m <= GEOFENCE_RADIUS_M)
        .sort((a, b) => a.distance_m - b.distance_m)
        .slice(0, 5)

      setPreviousCalls(withDistance)
    } catch (err) {
      console.error('Error loading previous calls', err)
      setPreviousCallsError('Error loading previous calls.')
    } finally {
      setLoadingPreviousCalls(false)
    }
  }, [organizationId, coords])

  // ========== HELPERS ==========
  function resetFormFields() {
    setCompany('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setWebsite('')
    setContactTitle('')
    setBuyingRole('')
    setIndustry('')
    setStatus('')
    setRating('')
    setCallType('')
    setNote('')
    setFollowUpDate('')
    setSelectedCommonNote('')
    setImageFile(null)
    setImageLabel('')
    setSelectedLead(null)
  }

  function handleSelectPreviousCall(lead) {
    setSelectedLead(lead)
    setCompany(lead.company || '')
    setContactName(lead.contact_name || '')
    setContactEmail(lead.contact_email || '')
    setContactPhone(lead.contact_phone || '')
    setIndustry(lead.industry || '')
    setStatus(lead.status || '')
    setRating(lead.rating || '')
  }

  function formatDistanceFeet(meters) {
    if (meters == null) return ''
    const ft = meters * 3.28084
    if (ft < 10) return `${ft.toFixed(1)} ft`
    return `${Math.round(ft)} ft`
  }

  function lastCallSummary(call_history) {
    if (!Array.isArray(call_history) || call_history.length === 0) return ''
    const last = call_history[call_history.length - 1]
    const date =
      last.date || last.timestamp || last.ts || last.created_at || null
    const status = last.status || last.callType || last.type || ''
    const rating = last.rating || ''
    const parts = []
    if (date) parts.push(date)
    if (status) parts.push(status)
    if (rating) parts.push(`(${rating})`)
    return parts.join(' • ')
  }

  // Common note dropdown → append to note
  function handleCommonNoteChange(e) {
    const val = e.target.value
    setSelectedCommonNote(val)
    if (!val) return

    const toAppend =
      (commonNoteOptions.find((o) => o.value === val) ||
        commonNoteOptions.find((o) => o.label === val) || { label: val }).label

    setNote((prev) => (prev ? `${prev} ${toAppend}` : toAppend))
  }

  // ========== SEARCH BUSINESS INFO (STUB) ==========
  async function handleSearchBusinessInfo() {
    setSuggestedMessage(null)

    if (!coords) {
      setSuggestedMessage('Location not available yet.')
      return
    }

    setLoadingSuggested(true)
    try {
      setSuggestedMessage(
        'Business suggestions will come from Google Places here (not wired yet in this version).',
      )
    } finally {
      setLoadingSuggested(false)
    }
  }

  // ========== SCAN CARD BUTTON ==========
  function handleScanCardClick() {
    const input = document.getElementById('scanCardInput')
    if (input) input.click()
  }

  function handleCardFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImageLabel('')
      return
    }
    setImageFile(file)
    setImageLabel(file.name || 'Card image selected')
  }

  // ========== SUBMIT ==========
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMessage(null)
    setSubmitError(null)

    try {
      const ts = new Date().toISOString()

      const callRecord = {
        date: ts,
        status: status || null,
        rating: rating || null,
        call_type: callType || null,
        note: note || '',
        user_id: currentUserId || null,
      }

      const noteRecord = {
        date: ts,
        noteType: status || null,
        text: note || '',
        followUpDate: followUpDate || null,
        enteredByUserId: currentUserId || null,
      }

      if (selectedLead) {
        const existingCalls = Array.isArray(selectedLead.call_history)
          ? selectedLead.call_history
          : []
        const newCalls = [...existingCalls, callRecord]

        const { error } = await supabase
          .from('leads')
          .update({
            company: company || null,
            contact_name: contactName || null,
            contact_email: contactEmail || null,
            contact_phone: contactPhone || null,
            website: website || null,
            contact_title: contactTitle || null,
            buying_role: buyingRole || null,
            industry: industry || null,
            status: status || null,
            rating: rating || null,
            call_history: newCalls,
            updated_at: ts,
          })
          .eq('id', selectedLead.id)

        if (error) throw error
        setSubmitMessage('Follow-up saved to existing lead.')
      } else {
        const payload = {
          org_id: organizationId,
          company: company || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          website: website || null,
          contact_title: contactTitle || null,
          buying_role: buyingRole || null,
          industry: industry || null,
          status: status || null,
          rating: rating || null,
          source: 'sales_entry',
          owner_user_id: currentUserId || null,
          created_by_user_id: currentUserId || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          location_raw:
            coords != null ? `${coords.lat},${coords.lng}` : null,
          primary_image_url: null, // later: Supabase Storage URL
          call_history: [callRecord],
          note_history: [noteRecord],
          created_at: ts,
          updated_at: ts,
        }

        const { error } = await supabase.from('leads').insert(payload)
        if (error) throw error

        setSubmitMessage('New lead saved. Ready for the next entry.')
        resetFormFields()
      }
    } catch (err) {
      console.error('Submit error', err)
      setSubmitError(err.message || 'Error saving entry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ========== RENDER ==========
  return (
    <div>
      {/* Title */}
      <h1>Sales Activity Entry</h1>

      {/* Geofence toggle */}
      <label
        htmlFor="geofenceToggle"
        style={{ cursor: 'pointer', fontWeight: 600, marginTop: 4 }}
      >
        <input
          id="geofenceToggle"
          type="checkbox"
          checked={geofenceEnabled}
          onChange={(e) => setGeofenceEnabled(e.target.checked)}
          style={{ marginRight: 8, width: 'auto', minHeight: 'auto' }}
        />
        Enable Geofencing Alerts
      </label>
      {geoError && (
        <div className="helper" style={{ marginTop: 2 }}>
          {geoError}
        </div>
      )}

      {/* Top action buttons */}
      <div
        className="top-actions"
        style={{
          marginTop: 12,
          marginBottom: 8,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={loadPreviousCalls}
          disabled={loadingPreviousCalls}
        >
          {loadingPreviousCalls ? 'Loading nearby calls…' : 'Select Previous Call'}
        </button>
        <button
          type="button"
          onClick={handleSearchBusinessInfo}
          disabled={loadingSuggested}
        >
          {loadingSuggested ? 'Searching…' : 'Search Business Info'}
        </button>
      </div>

      {/* Scan Card button bar */}
      <button
        type="button"
        onClick={handleScanCardClick}
        style={{
          width: '100%',
          marginBottom: 10,
          background: 'var(--navy)',
          borderRadius: 9999,
        }}
      >
        Scan Card (Optional)
      </button>
      <input
        id="scanCardInput"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCardFileChange}
      />
      {imageLabel && (
        <div className="helper" style={{ marginTop: 2, marginBottom: 4 }}>
          {imageLabel}
        </div>
      )}

      {/* Status banners */}
      {loadingPreviousCalls && (
        <div className="status-banner" style={{ marginBottom: 6 }}>
          Processing nearby calls… Please wait.
        </div>
      )}
      {loadingSuggested && (
        <div className="status-banner" style={{ marginBottom: 6 }}>
          Processing suggested business info… Please wait.
        </div>
      )}
      {submitMessage && (
        <div
          className="status-banner status-success"
          style={{ marginBottom: 6, color: '#166534' }}
        >
          {submitMessage}
        </div>
      )}
      {(submitError || previousCallsError) && (
        <div
          className="status-banner"
          style={{ marginBottom: 6, color: '#b91c1c' }}
        >
          {submitError || previousCallsError}
        </div>
      )}
      {suggestedMessage && (
        <div className="helper" style={{ marginBottom: 8 }}>
          {suggestedMessage}
        </div>
      )}

      {/* Previous calls list */}
      {showPreviousCalls && previousCalls.length > 0 && (
        <>
          <div className="section-title">Previous calls nearby</div>
          <div className="section-divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previousCalls.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className="lead-card"
                style={{
                  textAlign: 'left',
                  border:
                    selectedLead && selectedLead.id === lead.id
                      ? '2px solid #3b82f6'
                      : undefined,
                }}
                onClick={() => handleSelectPreviousCall(lead)}
              >
                <div style={{ fontWeight: 700 }}>
                  {lead.company || '(No company)'}{' '}
                  <span style={{ fontWeight: 400, color: '#6b7280' }}>
                    • {formatDistanceFeet(lead.distance_m)}
                  </span>
                </div>
                {(lead.contact_name ||
                  lead.contact_phone ||
                  lead.contact_email) && (
                  <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                    {lead.contact_name && <span>{lead.contact_name}</span>}
                    {lead.contact_phone && (
                      <span> • {lead.contact_phone}</span>
                    )}
                    {lead.contact_email && (
                      <span> • {lead.contact_email}</span>
                    )}
                  </div>
                )}
                {lead.call_history && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginTop: 2,
                    }}
                  >
                    {lastCallSummary(lead.call_history)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="section-title" style={{ marginTop: 14 }}>
        Call details
      </div>
      <div className="section-divider" />

      {/* MAIN FORM */}
      <form onSubmit={handleSubmit}>
        {/* Company + contact row */}
        <div className="row">
          <div>
            <label htmlFor="company">Company (Required)</label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company Name"
              required
            />
          </div>
          <div>
            <label htmlFor="contactName">Contact Name</label>
            <input
              id="contactName"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact Name"
            />
          </div>
        </div>

        {/* Title + buying role */}
        <div className="row">
          <div>
            <label htmlFor="contactTitle">Contact Title</label>
            <input
              id="contactTitle"
              type="text"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              placeholder="e.g., Operations Manager"
            />
          </div>
          <div>
            <label htmlFor="buyingRole">Buying Role</label>
            <select
              id="buyingRole"
              value={buyingRole}
              onChange={(e) => setBuyingRole(e.target.value)}
            >
              <option value="">Select Buying Role</option>
              {buyingRoleOptions.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Email + phone */}
        <div className="row">
          <div>
            <label htmlFor="contactEmail">Email Address</label>
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email Address (Recommended)"
            />
          </div>
          <div>
            <label htmlFor="contactPhone">Phone Number</label>
            <input
              id="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(000) 000-0000"
            />
          </div>
        </div>

        {/* Website */}
        <div className="row">
          <div>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        {/* Common Note Entries dropdown */}
        <div>
          <label htmlFor="commonNoteSelect">
            Common Note Entries (Optional)
          </label>
          <select
            id="commonNoteSelect"
            value={selectedCommonNote}
            onChange={handleCommonNoteChange}
          >
            <option value="">Select a common note</option>
            {commonNoteOptions.length === 0 && (
              <>
                <option value="Left voicemail">Left voicemail</option>
                <option value="Spoke with gatekeeper">
                  Spoke with gatekeeper
                </option>
                <option value="Requested quote">Requested quote</option>
              </>
            )}
            {commonNoteOptions.map((opt) => (
              <option key={opt.id || opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Call Note */}
        <label htmlFor="note">Call Note (Required)</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (Required)"
          required
        />

        {/* Call Type, Status, Industry */}
        <div className="row">
          <div>
            <label htmlFor="callType">Call Type</label>
            <select
              id="callType"
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
            >
              <option value="">Select Call Type</option>
              {callTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="status">Call Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Select Call Status</option>
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="industry">Industry (Required)</label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
            >
              <option value="">Industry (Required)</option>
              {industryOptions.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Follow-up date */}
        <div className="row">
          <div>
            <label htmlFor="followUpDate">Follow-up Date (Optional)</label>
            <input
              id="followUpDate"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>
        </div>

        {/* Bottom buttons (Submit + Clear) */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            type="submit"
            className="primary"
            disabled={submitting || !organizationId}
          >
            {submitting
              ? 'Saving…'
              : selectedLead
              ? 'Save Follow-up'
              : 'Submit'}
          </button>
          <button
            type="button"
            onClick={resetFormFields}
            disabled={submitting}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  )
}

export default SalesEntryForm
