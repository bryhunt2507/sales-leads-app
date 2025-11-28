// src/SalesEntryForm.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

// Match your old GAS radius: 300 meters (~984 ft)
const GEOFENCE_RADIUS_M = 3000

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

  // ❌ BAD (what you have right now)
  // const c = 2 * Math.atan2(Math.sqrt(1 - a), Math.sqrt(a))

  // ✅ GOOD – standard haversine formula
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

  const [previousCalls, setPreviousCalls] = useState([])
  const [loadingPreviousCalls, setLoadingPreviousCalls] = useState(false)
  const [previousCallsError, setPreviousCallsError] = useState(null)

  // Modal for previous calls / search
  const [showPrevModal, setShowPrevModal] = useState(false)

  // Search inside modal
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // ---- Business suggestions (Google Places via Supabase function) ----
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

  // ---- SUBMIT STATE ----
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const [geoDebug, setGeoDebug] = useState(null)


  // ================= GEOLOCATION =================
  useEffect(() => {
    if (!geofenceEnabled) return
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        console.log('[GEO] initial browser location', next)
        setCoords(next)
        setGeoError(null)
      },
      (err) => {
        console.error('[GEO] error', err)
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
    console.log('[GEO] ensureCoords fetched', c)
    setCoords(c)
    return c
  }

  // ================= PREVIOUS CALLS (within radius) =================
  const loadPreviousCalls = useCallback(
  async (reason = 'manual') => {
    if (!organizationId) return

    setLoadingPreviousCalls(true)
    setPreviousCallsError(null)

    try {
      const current = await ensureCoords()
      if (!current) {
        setPreviousCallsError('Location not available yet.')
        return
      }

      console.log('[PREV] loading nearby calls, reason:', reason)
      console.log('[PREV] using coords:', current)

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

      console.log('[PREV] raw rows from Supabase:', data?.length || 0)

      // 1) Compute distance for all rows with valid lat/lng
      const withDistanceAll = (data || [])
        .map((row) => {
          const lat =
            typeof row.latitude === 'number'
              ? row.latitude
              : parseFloat(row.latitude)
          const lng =
            typeof row.longitude === 'number'
              ? row.longitude
              : parseFloat(row.longitude)

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null
          }

          const d = distanceInMeters(current.lat, current.lng, lat, lng)

          return {
            ...row,
            latitude: lat,
            longitude: lng,
            distance_m: d,
          }
        })
        .filter((r) => r !== null)
        .sort((a, b) => a.distance_m - b.distance_m)

      // 2) Filter those within the geofence radius
      const withinRadius = withDistanceAll
        .filter((r) => r.distance_m <= GEOFENCE_RADIUS_M)
        .slice(0, 5)

      console.log(
        `[PREV] ${withinRadius.length} leads within ${GEOFENCE_RADIUS_M}m`,
        withinRadius.map((r) => ({
          id: r.id,
          company: r.company,
          distance_ft: (r.distance_m * 3.28084).toFixed(1),
        })),
      )

      setPreviousCalls(withinRadius)

      // 3) Store a small debug snapshot for UI
      setGeoDebug({
        coords: current,
        totalWithLatLng: withDistanceAll.length,
        nearestSamples: withDistanceAll.slice(0, 5).map((r) => ({
          company: r.company,
          distance_m: r.distance_m,
          distance_ft: r.distance_m * 3.28084,
        })),
      })
    } catch (err) {
      console.error('Error loading previous calls', err)
      setPreviousCallsError('Error loading previous calls.')
    } finally {
      setLoadingPreviousCalls(false)
    }
  },
  [organizationId, coords],
)


  // Open / close modal
  function openPreviousCallModal() {
    setShowPrevModal(true)
    setSearchTerm('')
    setSearchResults([])
    setSearchError(null)
    loadPreviousCalls('open-modal')
  }

  function closePreviousCallModal() {
    setShowPrevModal(false)
  }

  function handlePickPreviousLead(lead) {
    setSelectedLead(lead)
    setCompany(lead.company || '')
    setContactName(lead.contact_name || '')
    setContactEmail(lead.contact_email || '')
    setContactPhone(lead.contact_phone || '')
    setIndustry(lead.industry || '')
    setStatus(lead.status || '')
    setRating(lead.rating || '')
    setShowPrevModal(false)
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

  // ================= SEARCH LEADS (name/email/phone) =================
  async function handleSearchLeads(e) {
    e.preventDefault()
    const term = searchTerm.trim()
    if (!term) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    setSearchError(null)

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
        .or(
          `company.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%,contact_phone.ilike.%${term}%`,
        )
        .order('updated_at', { ascending: false })
        .limit(25)

      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('Search leads error', err)
      setSearchError(err.message || 'Error searching leads.')
    } finally {
      setSearchLoading(false)
    }
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

  // ================= SCAN CARD BUTTON (file only for now) =================
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
  }

  // ================= SUBMIT =================
  async function handleSubmit(e) {
  e.preventDefault()
  setSubmitting(true)
  setSubmitMessage(null)
  setSubmitError(null)

  try {
    const ts = new Date().toISOString()

    // 🔥 Always try to grab a fresh location for this call
    let effectiveCoords = null
    try {
      effectiveCoords = await getBrowserLocation()
      console.log('[SUBMIT] fresh browser location', effectiveCoords)
      setCoords(effectiveCoords) // keep state in sync
    } catch (locErr) {
      console.warn(
        '[SUBMIT] could not refresh location, using existing coords state',
        locErr,
      )
      effectiveCoords = coords || null
    }

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
      
  // Try to make sure we have a fresh location when creating a new lead
  let finalCoords = coords
  if (geofenceEnabled) {
    try {
      finalCoords = await ensureCoords()
    } catch (e) {
      console.warn('[SUBMIT] could not refresh coords on submit', e)
      // not fatal – we just won’t save lat/lng for this lead
    }
  }

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

    // 👇 use the best coords we have
    latitude: effectiveCoords?.lat ?? null,
  longitude: effectiveCoords?.lng ?? null,
  location_raw: effectiveCoords
    ? `${effectiveCoords.lat},${effectiveCoords.lng}`
    : null,

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
        <button type="button" onClick={openPreviousCallModal}>
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
                <option key={opt.id} value={opt.value || opt.label}>
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
                <option key={opt.id} value={opt.value || opt.label}>
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
                <option key={opt.id} value={opt.value || opt.label}>
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
                <option key={opt.id} value={opt.value || opt.label}>
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

      {/* PREVIOUS CALLS MODAL (nearby + search) */}
      {showPrevModal && (
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
          <div
            className="card"
            style={{
              maxWidth: 720,
              width: '100%',
              maxHeight: '100%',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                Select Previous Call
              </h3>
              <button
                type="button"
                onClick={closePreviousCallModal}
                style={{
                  minHeight: 32,
                  paddingInline: 10,
                  background: '#0f172a',
                }}
              >
                Close
              </button>
            </div>

            <div className="section-title">Nearby (within ~300 ft)</div>
            <div className="section-divider" />

            {loadingPreviousCalls && (
              <p className="helper">Loading nearby calls…</p>
            )}
            {previousCallsError && (
              <p className="helper" style={{ color: '#b91c1c' }}>
                {previousCallsError}
              </p>
            )}
            {!loadingPreviousCalls &&
              !previousCallsError &&
              previousCalls.length === 0 && (
                <p className="helper">
                  No previous calls found near your current location.
                </p>
              )}

            {!loadingPreviousCalls && previousCalls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {previousCalls.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="lead-card"
                    style={{ textAlign: 'left' }}
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

            {/* Search section */}
            <div className="section-title" style={{ marginTop: 16 }}>
              Search by name, email, phone
            </div>
            <div className="section-divider" />

            <form
              onSubmit={handleSearchLeads}
              style={{ display: 'flex', gap: 8, marginBottom: 8 }}
            >
              <input
                type="text"
                placeholder="Search company, contact, email, or phone"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="submit"
                disabled={searchLoading || !searchTerm.trim()}
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </form>

            {searchError && (
              <p className="helper" style={{ color: '#b91c1c' }}>
                {searchError}
              </p>
            )}

            {searchResults.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                {searchResults.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="lead-card"
                    style={{ textAlign: 'left' }}
                    onClick={() => handlePickPreviousLead(lead)}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {lead.company || '(No company)'}
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
        </div>
      )}
      {geoDebug && (
  <pre
    style={{
      marginTop: 12,
      fontSize: '10px',
      background: '#f3f4f6',
      padding: 8,
      borderRadius: 6,
      color: '#4b5563',
      whiteSpace: 'pre-wrap',
    }}
  >
{`GEO DEBUG
coords: ${geoDebug.coords ? `${geoDebug.coords.lat.toFixed(6)}, ${geoDebug.coords.lng.toFixed(6)}` : 'none'}
total leads with lat/lng: ${geoDebug.totalWithLatLng}
nearest samples:
${geoDebug.nearestSamples
  .map(
    (s, i) =>
      `${i + 1}. ${s.company} – ${(s.distance_ft).toFixed(
        1,
      )} ft (${s.distance_m.toFixed(1)} m)`,
  )
  .join('\n')}`}
  </pre>
)}

    </div>
  )
}

export default SalesEntryForm
