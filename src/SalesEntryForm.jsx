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

  // Business suggestions (Google Places via Supabase function)
  const [businessSuggestions, setBusinessSuggestions] = useState([])
  const [loadingBiz, setLoadingBiz] = useState(false)
  const [bizError, setBizError] = useState(null)

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
  const [imageLabel, setImageLabel] = useState('')

  const [selectedLead, setSelectedLead] = useState(null) // when following up on existing lead

  // ---- SCAN CARD STATE ----
  const [scanningCard, setScanningCard] = useState(false)
  const [scanError, setScanError] = useState(null)

  // ---- SUBMIT STATE ----
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  // ================= GEOLOCATION (live for geofence toggle) =================
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

  function getBrowserLocation() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation not supported on this device.'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          resolve({ lat: latitude, lng: longitude })
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        },
      )
    })
  }

  async function ensureCoords() {
    if (coords) return coords
    const c = await getBrowserLocation()
    setCoords(c)
    return c
  }

  // ================= PREVIOUS CALLS (within ~300 ft) =================
  const loadPreviousCalls = useCallback(async () => {
    if (!organizationId) return

    setShowPreviousCalls(true)
    setLoadingPreviousCalls(true)
    setPreviousCallsError(null)

    try {
      const current = await ensureCoords()
      if (!current) {
        setPreviousCallsError('Location not available yet.')
        return
      }

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
            current.lat,
            current.lng,
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

  function handlePickPreviousLead(lead) {
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
    const stat = last.status || last.callType || last.type || ''
    const r = last.rating || ''
    const parts = []
    if (date) parts.push(date)
    if (stat) parts.push(stat)
    if (r) parts.push(`(${r})`)
    return parts.join(' • ')
  }

  // ================= COMMON NOTE DROPDOWN =================
  function handleCommonNoteChange(e) {
    const val = e.target.value
    setSelectedCommonNote(val)
    if (!val) return

    const toAppend =
      (commonNoteOptions.find((o) => o.value === val) ||
        commonNoteOptions.find((o) => o.label === val) || { label: val }).label

    setNote((prev) => (prev ? `${prev} ${toAppend}` : toAppend))
  }

  // ================= SEARCH BUSINESS INFO (SUPABASE FUNCTION) =================
  async function handleSearchBusinessInfo() {
    setSuggestedMessage(null)
    setBizError(null)

    try {
      const current = await ensureCoords()
      if (!current) {
        setSuggestedMessage('Location not available yet.')
        return
      }

      setLoadingBiz(true)

      const { data, error } = await supabase.functions.invoke(
        'get-suggested-businesses',
        {
          body: { lat: current.lat, lon: current.lng },
        },
      )

      if (error) throw error
      setBusinessSuggestions(data || [])
      if (!data || data.length === 0) {
        setSuggestedMessage('No nearby businesses found.')
      } else {
        setSuggestedMessage(
          'Tap a business below to prefill company / phone / website.',
        )
      }
    } catch (err) {
      console.error('Business info error', err)
      setBizError('Could not load nearby businesses. Check location + API key.')
    } finally {
      setLoadingBiz(false)
    }
  }

  function applyBusinessSuggestion(biz) {
    if (!biz) return
    setCompany(biz.name || '')
    if (biz.phone) setContactPhone(biz.phone)
    if (biz.website) setWebsite(biz.website)
    if (biz.address) {
      setNote((prev) =>
        prev ? `${prev}\nAddress: ${biz.address}` : `Address: ${biz.address}`,
      )
    }
  }

  // ================= SCAN CARD BUTTON =================
  function handleScanCardClick() {
    const input = document.getElementById('scanCardInput')
    if (input) input.click()
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result || ''
        const str = typeof result === 'string' ? result : ''
        const base64 = str.includes(',')
          ? str.split(',')[1]
          : str
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleCardFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImageLabel('')
      return
    }

    setImageFile(file)
    setImageLabel(file.name || 'Card image selected')
    setScanError(null)
    setScanningCard(true)

    try {
      const base64 = await fileToBase64(file)

      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        console.error('scan-card error:', json)
        const msg = json.error || 'Card scan failed'
        setScanError(msg)
        alert(msg)
        return
      }

      const data = json.data || {}

      // Only fill empty fields so we don't stomp user edits
      if (!company && data.company) setCompany(data.company)
      if (!contactName && data.contact) setContactName(data.contact)
      if (!contactTitle && data.contactTitle)
        setContactTitle(data.contactTitle)
      if (!contactEmail && data.email) setContactEmail(data.email)
      if (!contactPhone && data.phone) setContactPhone(data.phone)
      if (!website && data.website) setWebsite(data.website)
    } catch (err) {
      console.error('Card scan exception:', err)
      const msg = 'Problem scanning card.'
      setScanError(msg)
      alert(msg)
    } finally {
      setScanningCard(false)
      // allow re-selecting the same file
      if (e.target) e.target.value = ''
    }
  }

  // ================= RESET FORM =================
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
    setScanError(null)
  }

  // ================= SUBMIT =================
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
          primary_image_url: null,
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

  // ================= RENDER =================
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
        <button type="button" onClick={loadPreviousCalls}>
          {loadingPreviousCalls ? 'Loading nearby calls…' : 'Select Previous Call'}
        </button>
        <button type="button" onClick={handleSearchBusinessInfo}>
          {loadingBiz ? 'Searching…' : 'Search Business Info'}
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
        disabled={scanningCard}
      >
        {scanningCard ? 'Scanning card…' : 'Scan Card (Optional)'}
      </button>
      <input
        id="scanCardInput"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCardFileChange}
      />
      {imageLabel && (
        <div className="helper" style={{ marginTop: 2, marginBottom: 4 }}>
          {imageLabel}
        </div>
      )}
      {scanError && (
        <div
          className="helper"
          style={{ marginTop: 2, marginBottom: 4, color: '#b91c1c' }}
        >
          {scanError}
        </div>
      )}

      {/* Previous calls panel */}
      {showPreviousCalls && (
        <div className="card previous-calls-panel" style={{ marginBottom: 10 }}>
          <div className="section-title">Previous calls within ~300 ft</div>
          {loadingPreviousCalls && (
            <p className="helper">Loading nearby calls…</p>
          )}

          {previousCallsError && (
            <p className="helper" style={{ color: '#b91c1c' }}>
              {previousCallsError}
            </p>
          )}

          {!loadingPreviousCalls &&
            previousCalls.length === 0 &&
            !previousCallsError && (
              <p className="helper">No recent nearby calls found.</p>
            )}

          {!loadingPreviousCalls && previousCalls.length > 0 && (
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
                  onClick={() => handlePickPreviousLead(lead)}
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
          )}
        </div>
      )}

      {/* Business suggestions list */}
      {businessSuggestions.length > 0 && (
        <div
          className="card business-suggestions-panel"
          style={{ marginBottom: 10 }}
        >
          <div className="section-title">Nearby businesses</div>
          {bizError && (
            <p className="helper" style={{ color: '#b91c1c' }}>
              {bizError}
            </p>
          )}
          {suggestedMessage && (
            <p className="helper" style={{ marginBottom: 4 }}>
              {suggestedMessage}
            </p>
          )}
          <ul
            className="business-suggestions-list"
            style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}
          >
            {businessSuggestions.map((biz) => (
              <li
                key={biz.placeId || biz.name}
                className="business-suggestion-item"
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '6px 10px',
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
                onClick={() => applyBusinessSuggestion(biz)}
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
      )}

      {/* Status banners */}
      {submitMessage && (
        <div
          className="status-banner status-success"
          style={{ marginBottom: 6, color: '#166534' }}
        >
          {submitMessage}
        </div>
      )}
      {submitError && (
        <div
          className="status-banner"
          style={{ marginBottom: 6, color: '#b91c1c' }}
        >
          {submitError}
        </div>
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
                <option
                  key={opt.id}
                  value={opt.value || opt.label}
                >
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
              <option
                key={opt.id || opt.value || opt.label}
                value={opt.value || opt.label}
              >
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
                <option
                  key={opt.id}
                  value={opt.value || opt.label}
                >
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
                <option
                  key={opt.id}
                  value={opt.value || opt.label}
                >
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
                <option
                  key={opt.id}
                  value={opt.value || opt.label}
                >
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
