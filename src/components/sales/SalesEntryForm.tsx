import { useBusinessSuggestions } from '../../hooks/UseBusinessSuggestions'
import { BusinessSuggestionsPanel } from './BusinessSuggestionsPanel'

// src/components/sales/SalesEntryForm.tsx
import React, { useState } from 'react'
// src/components/sales/SalesEntryForm.tsx
import { useGeolocation } from '../../hooks/useGeolocation'
import { usePreviousCalls } from '../../hooks/usePreviousCalls'
import { useLeadSearch } from '../../hooks/useLeadSearch'
import { PreviousCallsModal } from './PreviousCallsModal'
import { insertLead, updateLead, Lead } from '../../services/leadService'

interface Props {
  organizationId: string
  currentUserId: string
  statusOptions: any[]
  ratingOptions: any[]
  industryOptions: any[]
  buyingRoleOptions: any[]
  callTypeOptions: any[]
  commonNoteOptions?: { id?: string; label: string; value?: string }[]
}

export const SalesEntryForm: React.FC<Props> = ({
  organizationId,
  currentUserId,
  statusOptions,
  ratingOptions,
  industryOptions,
  buyingRoleOptions,
  callTypeOptions,
  commonNoteOptions = [],
}) => {
  const [geofenceEnabled, setGeofenceEnabled] = useState(true)
  const { coords, error: geoError, refresh } = useGeolocation(geofenceEnabled)

 const {
  loading: loadingPrevious,
  error: previousError,
  nearby: previousCalls,
  debug: geoDebug,
  load: loadPrevious,
} = usePreviousCalls(organizationId)

  const {
    term: searchTerm,
    setTerm: setSearchTerm,
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    runSearch,
  } = useLeadSearch(organizationId)

// ---- Business suggestions (Google Places via Supabase function) ----
const {
  suggestions: businessSuggestions,
  loading: loadingBiz,
  error: bizError,
  message: suggestedMessage,
  search: searchBusinesses,
} = useBusinessSuggestions()

const [showBusinessModal, setShowBusinessModal] = useState(false)


  // inside SalesEntryForm component

function handleSearchNearbyBusinesses() {
  // coords is already coming from your geolocation hook / state
  searchBusinesses()
}

  const [showPrevModal, setShowPrevModal] = useState(false)

  // form fields
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

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageLabel, setImageLabel] = useState('')

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)


  function openPreviousCallModal() {
    setShowPrevModal(true)
    loadPrevious(coords || null)
  }

  function handlePickPreviousLead(lead: Lead) {
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

  function handleCommonNoteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedCommonNote(val)
    if (!val) return
    const toAppend =
      (commonNoteOptions.find((o) => o.value === val) ||
        commonNoteOptions.find((o) => o.label === val) || { label: val }).label
    setNote((prev) => (prev ? `${prev} ${toAppend}` : toAppend))
  }

  function handleScanCardClick() {
    const input = document.getElementById('scanCardInput') as HTMLInputElement | null
    if (input) input.click()
  }

function handleOpenBusinessModal() {
  setShowBusinessModal(true)
  // Let the hook do its thing (it will use coords internally
  // or however you wired it)
  searchBusinesses()
}


  function handleCardFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImageLabel('')
      return
    }
    setImageFile(file)
    setImageLabel(file.name || 'Card image selected')
    // later: call scanBusinessCard(file) and prefill fields
  }

  function applyBusinessSuggestion(biz: any) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMessage(null)
    setSubmitError(null)

    try {
      const ts = new Date().toISOString()
      const effectiveCoords = coords || null

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

        await updateLead(selectedLead.id, {
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
        } as any)

        setSubmitMessage('Follow-up saved to existing lead.')
      } else {
        await insertLead({
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
        } as any)

        setSubmitMessage('New lead saved. Ready for the next entry.')
        resetFormFields()
      }
    } catch (err: any) {
      console.error('Submit error', err)
      setSubmitError(err.message || 'Error saving entry.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Sales Activity Entry</h1>

      {/* Geofence toggle */}
      <label htmlFor="geofenceToggle" style={{ cursor: 'pointer', fontWeight: 600, marginTop: 4 }}>
        <input
          id="geofenceToggle"
          type="checkbox"
          checked={geofenceEnabled}
          onChange={(e) => {
            setGeofenceEnabled(e.target.checked)
            if (e.target.checked) refresh()
          }}
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
    {loadingPrevious ? 'Loading nearby calls…' : 'Select Previous Call'}
  </button>

  <button type="button" onClick={handleOpenBusinessModal}>
  {loadingBiz ? 'Searching nearby…' : 'Search Nearby Businesses'}
</button>
</div>


      {/* Scan Card */}
      <button
        type="button"
        onClick={handleScanCardClick}
        style={{ width: '100%', marginBottom: 10, background: 'var(--navy)', borderRadius: 9999 }}
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

      <BusinessSuggestionsPanel
        suggestions={businessSuggestions}
        message={suggestedMessage}
        error={bizError}
        onSelect={applyBusinessSuggestion}
      />

      {/* submit banners */}
      {submitMessage && (
        <div className="status-banner status-success" style={{ marginBottom: 6, color: '#166534' }}>
          {submitMessage}
        </div>
      )}
      {submitError && (
        <div className="status-banner" style={{ marginBottom: 6, color: '#b91c1c' }}>
          {submitError}
        </div>
      )}

      {/* --- MAIN FORM --- */}
      {/* (keep your existing form markup – I’ll omit repeating all of it here since it’s 1:1 copy) */}
      {/* Use handleSubmit on <form>, same fields as before */}

      {/* ... paste your existing form JSX here, wired to the state setters above ... */}

      {/* Previous calls modal */}
      <PreviousCallsModal
        open={showPrevModal}
        onClose={() => setShowPrevModal(false)}
        nearby={previousCalls}
        loadingNearby={loadingPrevious}
        nearbyError={previousError}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchLoading={searchLoading}
        searchError={searchError}
        searchResults={searchResults}
        onSearchSubmit={runSearch}
        onPickLead={handlePickPreviousLead}
      />

      {/* Optional: tiny geo debug */}
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
coords: ${geoDebug.coords ? `${geoDebug.coords.lat}, ${geoDebug.coords.lng}` : 'none'}
total leads with lat/lng: ${geoDebug.totalWithLatLng}`}
        </pre>
      )}
    </div>
  )
}

export default SalesEntryForm
