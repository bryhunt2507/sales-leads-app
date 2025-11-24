// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import AdminOptions from './AdminOptions.jsx'
import MainHome from './MainHome.jsx'
import LeadManagement from './LeadManagement.jsx'


async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Default org for now (your existing org)
const DEFAULT_ORGANIZATION_ID = '53f11d6b-1874-479f-9f27-ea3d27787d7f'

function App() {
  // Auth / profile / organization
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organizationId, setOrganizationId] = useState(DEFAULT_ORGANIZATION_ID)
  const [authLoading, setAuthLoading] = useState(true)

const [geofenceEnabled, setGeofenceEnabled] = useState(false)
const [showPreviousCalls, setShowPreviousCalls] = useState(false)


  // 'home' | 'entry' | 'admin'
  const [view, setView] = useState('home')
  const [selectedBusiness, setSelectedBusiness] = useState(null)

  // OCR endpoint
  const CARD_OCR_ENDPOINT = '/api/ocr'

  // Dropdown options
  const [statusOptions, setStatusOptions] = useState([])
  const [ratingOptions, setRatingOptions] = useState([])
  const [industryOptions, setIndustryOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [form, setForm] = useState({
  company: '',
  contact_name: '',
  contact_title: '',
  buying_role: '',
  email: '',
  phone: '',
  ext: '',
  website: '',
  note: '',
  call_type: '',   // UI-only for now, stored in business_info JSON
  status: '',      // this will be "Lead Status" on screen
  rating: '',
  industry: '',
  latitude: '',
  longitude: '',
})


  const [statusMsg, setStatusMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  // Leads list
  const [leads, setLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [locStatus, setLocStatus] = useState(null)

  // Nearby business lookup
  const [businesses, setBusinesses] = useState([])
  const [loadingBusinesses, setLoadingBusinesses] = useState(false)
  const [businessError, setBusinessError] = useState(null)
  const [showBusinessPicker, setShowBusinessPicker] = useState(false)

  // Safely turn category object/string into a plain label
  const categoryLabel =
    selectedBusiness && selectedBusiness.category
      ? typeof selectedBusiness.category === 'string'
        ? selectedBusiness.category
        : selectedBusiness.category.text || ''
      : ''

  // ------------------------
  // Auth: load user + profile + org once, and on auth changes
  // ------------------------
  useEffect(() => {
    let isMounted = true

    async function syncFromUser(user) {
      if (!isMounted) return

      setAuthUser(user ?? null)

      if (!user?.email) {
        setProfile(null)
        setOrganizationId(DEFAULT_ORGANIZATION_ID)
        return
      }

      try {
        const { data: profileRow, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .maybeSingle()

        if (error) {
          console.error('Error loading profile', error)
        }

        if (profileRow) {
          setProfile(profileRow)
          setOrganizationId(
            profileRow.organization_id || DEFAULT_ORGANIZATION_ID
          )
        } else {
          // Optionally create a default profile
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              email: user.email,
              role: 'user',
              organization_id: DEFAULT_ORGANIZATION_ID,
            })
            .select()
            .maybeSingle()

          if (insertError) {
            console.error('Error creating default profile', insertError)
            setProfile(null)
            setOrganizationId(DEFAULT_ORGANIZATION_ID)
          } else if (newProfile) {
            setProfile(newProfile)
            setOrganizationId(
              newProfile.organization_id || DEFAULT_ORGANIZATION_ID
            )
          }
        }
      } catch (err) {
        console.error('Error syncing auth/profile', err)
        setProfile(null)
        setOrganizationId(DEFAULT_ORGANIZATION_ID)
      }
    }

    async function init() {
      try {
        setAuthLoading(true)
        const {
          data: { user },
        } = await supabase.auth.getUser()
        await syncFromUser(user ?? null)
      } catch (err) {
        console.error('Error loading auth user', err)
      } finally {
        if (isMounted) setAuthLoading(false)
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        syncFromUser(session?.user ?? null)
      }
    )

    return () => {
      isMounted = false
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  // Start Google OAuth login
  async function handleProviderLogin() {
    try {
      const redirectUrl =
        typeof window !== 'undefined' ? window.location.origin : undefined

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) {
        console.error('OAuth error', error)
        alert('Error starting Google sign-in: ' + error.message)
      }
    } catch (err) {
      console.error('OAuth error', err)
      alert('Error starting Google sign-in.')
    }
  }

  // Log out
  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      setAuthUser(null)
      setProfile(null)
      setOrganizationId(DEFAULT_ORGANIZATION_ID)
      window.location.reload()
    } catch (err) {
      console.error('Logout error', err)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Card OCR handler
  async function handleScanCard() {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment' // prefer rear camera on mobile

      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return

        setStatusMsg(null)
        setLocStatus('Processing card photo…')

        try {
          const base64 = await fileToBase64(file)

          const res = await fetch(CARD_OCR_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              latitude: form.latitude,
              longitude: form.longitude,
            }),
          })

          if (!res.ok) {
            console.error('OCR error', res.status)
            setLocStatus('Card scan failed. Please try again.')
            return
          }

          const data = await res.json()

          // { company, contact, email, phone, imageUrl }
          setForm(prev => ({
            ...prev,
            company: data.company || prev.company,
            contact_name: data.contact || prev.contact_name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
          }))

          setLocStatus('Card scanned. Fields updated from the card ✅')
        } catch (err) {
          console.error(err)
          setLocStatus('Card scan failed. Please try again.')
        }
      }

      input.click()
    } catch (e) {
      console.error(e)
    }
  }

  // Load dropdown options for the current organization
  async function loadOptionLists() {
    if (!organizationId) return
    setLoadingOptions(true)

    const [statusRes, ratingRes, industryRes] = await Promise.all([
      supabase
        .from('call_status_options')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('rating_options')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('industry_options')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ])

    if (statusRes.error) console.error('Status options error:', statusRes.error)
    if (ratingRes.error) console.error('Rating options error:', ratingRes.error)
    if (industryRes.error)
      console.error('Industry options error:', industryRes.error)

    if (!statusRes.error && statusRes.data) setStatusOptions(statusRes.data)
    if (!ratingRes.error && ratingRes.data) setRatingOptions(ratingRes.data)
    if (!industryRes.error && industryRes.data) setIndustryOptions(industryRes.data)

    setLoadingOptions(false)
  }

  // Load leads (used by the phone app side)
async function loadLeads() {
  if (!organizationId) return
  setLoadingLeads(true)

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('org_id', organizationId) // <- correct column
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error loading leads:', error)
  } else {
    setLeads(data || [])
  }

  setLoadingLeads(false)
}


  // Get GPS location once
  function autoGetLocation() {
    if (!navigator.geolocation) {
      setLocStatus('Geolocation not supported on this device.')
      return
    }

    setLocStatus('Getting your location…')

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords
        setForm(prev => ({
          ...prev,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        }))
        setLocStatus(
          `Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        )
      },
      error => {
        console.error(error)
        setLocStatus('Unable to get location.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    )
  }

  // Device location on mount
  useEffect(() => {
    autoGetLocation()
  }, [])

  // Whenever organizationId changes, load org-specific data
  useEffect(() => {
    if (!organizationId) return
    loadLeads()
    loadOptionLists()
  }, [organizationId])

  // Nearby business handler
  async function handleFindNearbyBusinesses() {
    setBusinessError(null)

    let lat = form.latitude
    let lng = form.longitude

    // If we don't have coords yet, try to get them
    if (!lat || !lng) {
      if (!navigator.geolocation) {
        setBusinessError('Geolocation not supported on this device.')
        return
      }

      setLocStatus('Getting your location before searching nearby…')

      try {
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            err => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          )
        })
        lat = coords.latitude.toString()
        lng = coords.longitude.toString()
        setForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))
        setLocStatus(
          `Location detected: ${coords.latitude.toFixed(
            5
          )}, ${coords.longitude.toFixed(5)}`
        )
      } catch (err) {
        console.error(err)
        setLocStatus('Unable to get location for nearby search.')
        setBusinessError('Unable to get location.')
        return
      }
    }

    setLoadingBusinesses(true)
    setShowBusinessPicker(true)

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
      })

      const res = await fetch(`/api/places?${params.toString()}`)

      // Always read as text first so Safari can’t explode inside res.json()
      const raw = await res.text()
      console.log('Places raw response:', raw)

      // If dev server returned our HTML app shell, nearby search
      // isn't available in local dev.
      const trimmed = raw.trim().toLowerCase()
      const looksLikeHtml =
        trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')

      if (!res.ok || looksLikeHtml) {
        console.error('Places error or HTML shell', res.status, raw)
        setBusinessError(
          'Nearby business lookup only works on the live site right now. Try it at app.crmforstaffing.com.'
        )
        setBusinesses([])
      } else {
        let json
        try {
          json = raw ? JSON.parse(raw) : {}
        } catch (e) {
          console.error('Places JSON parse error', e, raw)
          setBusinessError('Nearby business lookup failed.')
          setBusinesses([])
          return
        }

        const bizList = json.businesses || []

        setBusinesses(bizList)
        setSelectedBusiness(bizList.length > 0 ? bizList[0] : null)

        if (bizList.length === 0) {
          setBusinessError('No nearby businesses found.')
        }
      }
    } catch (err) {
      console.error('Places fetch failed:', err)
      setBusinessError('Nearby business lookup failed.')
      setBusinesses([])
    } finally {
      setLoadingBusinesses(false)
    }
  }

  function handleSelectBusiness(biz) {
    // Prefill form from selected business
    setForm(prev => ({
      ...prev,
      company: biz.name || prev.company,
      note:
        prev.note ||
        (biz.address
          ? `${biz.address}${
              biz.phone ? ` • ${biz.phone}` : ''
            }${biz.website ? ` • ${biz.website}` : ''}`
          : prev.note),
    }))
    setShowBusinessPicker(false)
  }

  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setStatusMsg(null)

    if (!form.company && !form.contact_name) {
      setStatusMsg('error')
      setLoading(false)
      return
    }

    const phoneWithExt =
  form.phone && form.ext ? `${form.phone} x${form.ext}` : form.phone || null

const { data, error } = await supabase
  .from('leads')
  .insert([
    {
      org_id: organizationId || DEFAULT_ORGANIZATION_ID,
      company: form.company,
      contact_name: form.contact_name || null,
      contact_title: form.contact_title || null,
      buying_role: form.buying_role || null,
      contact_email: form.email || null,
      contact_phone: phoneWithExt,
      website: form.website || null,
      status: form.status || null,   // "Lead Status" on the UI
      rating: form.rating || null,
      industry: form.industry || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      // store call_type in JSON so we don't need a new column yet
      business_info: form.call_type
        ? { call_type: form.call_type }
        : null,
    },
  ])
  .select()

    if (error) {
      console.error(error)
      setStatusMsg('error')
    } else {
      setStatusMsg('success')
      setForm({
  company: '',
  contact_name: '',
  contact_title: '',
  buying_role: '',
  email: '',
  phone: '',
  ext: '',
  website: '',
  note: '',
  call_type: '',
  status: '',
  rating: '',
  industry: '',
  latitude: '',
  longitude: '',
})


      if (data && data.length > 0) {
        setLeads(prev => [data[0], ...prev].slice(0, 20))
      }
    }

    setLoading(false)
  }

  return (
    <>
      {/* Top nav/header */}
      <header>
        <div className="header-inner">
          <div className="brand">
            <div className="brand-logo" />
            <span>CRM Staffing Sales</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setView('home')}
              style={{
                background: view === 'home' ? '#ffffff22' : 'transparent',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: '0.8rem',
                boxShadow: 'none',
              }}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setView('entry')}
              style={{
                background: view === 'entry' ? '#ffffff22' : 'transparent',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: '0.8rem',
                boxShadow: 'none',
              }}
            >
              Entry
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                style={{
                  background: view === 'admin' ? '#ffffff22' : 'transparent',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  boxShadow: 'none',
                }}
              >
                Admin
              </button>
            )}
            <div
              className="user-badge"
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              {authLoading ? (
                <span>Checking…</span>
              ) : authUser?.email ? (
                <>
                  <span>{authUser.email}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      background: '#ffffff22',
                      borderRadius: 999,
                      border: 'none',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      color: 'white',
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleProviderLogin}
                  style={{
                    background: '#ffffff22',
                    borderRadius: 999,
                    border: 'none',
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    color: 'white',
                  }}
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
  {view === 'home' ? (
    <MainHome organizationId={organizationId} />
  ) : (
          <div className="card">
            {view === 'entry' ? (
  <>
    <h1>Sales Activity Entry</h1>

    {/* TOP ACTION BAR: Select Previous Call + Search Business Info */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      <button
        type="button"
        onClick={() => setShowPreviousCalls(prev => !prev)}
        style={{
          minWidth: 180,
          background: '#0f2c4d',
        }}
      >
        Select Previous Call
      </button>

      <button
        type="button"
        onClick={handleFindNearbyBusinesses}
        style={{
          minWidth: 180,
          background: '#0f2c4d',
        }}
        disabled={loadingBusinesses}
      >
        {loadingBusinesses ? 'Searching…' : 'Search Business Info'}
      </button>
    </div>

    {/* SCAN CARD BAR */}
    <button
      type="button"
      onClick={handleScanCard}
      style={{
        width: '100%',
        marginBottom: 18,
        borderRadius: 999,
        background: '#0f2c4d',
      }}
    >
      Scan Card (Optional)
    </button>

    {/* MAIN FORM */}
    <form onSubmit={handleSubmit}>
      {/* CONTACT INFO ROW 1 */}
      <div className="row">
        <div>
          <label>Company</label>
          <input
            name="company"
            placeholder="Company Name (Required)"
            value={form.company}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Contact Name</label>
          <input
            name="contact_name"
            placeholder="Contact Name"
            value={form.contact_name}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* CONTACT INFO ROW 2 */}
      <div className="row">
        <div>
          <label>Contact Title</label>
          <input
            name="contact_title"
            placeholder="e.g., Operations Manager"
            value={form.contact_title}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Buying Role</label>
          <input
            name="buying_role"
            placeholder="Gatekeeper, Decision Maker, etc."
            value={form.buying_role}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* CONTACT INFO ROW 3 */}
      <div className="row">
        <div>
          <label>Email Address</label>
          <input
            name="email"
            placeholder="Email Address (Recommended)"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Phone Number</label>
          <input
            name="phone"
            placeholder="(000) 000-0000"
            value={form.phone}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Extension (Optional)</label>
          <input
            name="ext"
            placeholder="Ext"
            value={form.ext}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* CONTACT INFO ROW 4 */}
      <div className="row">
        <div>
          <label>Website</label>
          <input
            name="website"
            placeholder="https://example.com"
            value={form.website}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* COMMON NOTE ENTRY + CALL NOTE */}
      <label>
        Common Note Entries (Optional)
        {/* For now a simple hard-coded list; later we can pull from a table */}
        <select
          onChange={e => {
            const value = e.target.value
            if (!value) return
            setForm(prev => ({
              ...prev,
              note: prev.note ? `${prev.note}\n${value}` : value,
            }))
            e.target.value = ''
          }}
        >
          <option value="">Select a common note</option>
          <option value="Stopped by for a quick intro.">
            Stopped by for a quick intro.
          </option>
          <option value="Left voicemail with callback number.">
            Left voicemail with callback number.
          </option>
          <option value="Requested rate sheet and follow-up meeting.">
            Requested rate sheet and follow-up meeting.
          </option>
        </select>
      </label>

      <label>
        Call Note
        <textarea
          name="note"
          placeholder="Note (Required)"
          value={form.note}
          onChange={handleChange}
        />
      </label>

      {/* CALL DETAILS */}
      <div className="section-title">Call Details</div>
      <div className="section-divider" />

      <label>
        Call Type
        {/* UI-only for now; stored in business_info JSON */}
        <select
          name="call_type"
          value={form.call_type}
          onChange={handleChange}
        >
          <option value="">Select Call Type</option>
          <option value="Cold Call">Cold Call</option>
          <option value="Follow-Up">Follow-Up</option>
          <option value="On-Site Visit">On-Site Visit</option>
          <option value="Virtual Meeting">Virtual Meeting</option>
        </select>
      </label>

      <label>
        Lead Status
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
        >
          <option value="">
            {loadingOptions ? 'Loading…' : 'Select Lead Status'}
          </option>
          {statusOptions.map(opt => (
            <option key={opt.id} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Call Rating
        <select
          name="rating"
          value={form.rating}
          onChange={handleChange}
        >
          <option value="">
            {loadingOptions ? 'Loading…' : 'Select Rating'}
          </option>
          {ratingOptions.map(opt => (
            <option key={opt.id} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Industry
        <select
          name="industry"
          value={form.industry}
          onChange={handleChange}
        >
          <option value="">
            {loadingOptions ? 'Loading…' : 'Industry (Required)'}
          </option>
          {industryOptions.map(opt => (
            <option key={opt.id} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* LOCATION / NEARBY BUSINESSES */}
      <div className="section-title">Location</div>
      <div className="section-divider" />

      {/* keep lat/lng hidden but still tracked */}
      <div style={{ display: 'none' }}>
        <input
          name="latitude"
          value={form.latitude}
          onChange={handleChange}
        />
        <input
          name="longitude"
          value={form.longitude}
          onChange={handleChange}
        />
      </div>

      {locStatus && (
        <div
          className="helper"
          style={{ marginTop: 8, marginBottom: 16 }}
        >
          {locStatus}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={handleFindNearbyBusinesses}
          style={{
            flex: 1,
            minWidth: 200,
            background: 'var(--navy-2)',
          }}
          disabled={loadingBusinesses}
        >
          {loadingBusinesses
            ? 'Searching nearby…'
            : 'Find Nearby Businesses'}
        </button>

        <button
          type="button"
          style={{
            flex: 1,
            minWidth: 200,
            background: '#0f2c4d',
          }}
          onClick={() => {
            // stub for "Upload Additional Image(s)" – to be wired later
            alert('Image upload coming soon (Supabase storage).')
          }}
        >
          Upload Additional Image(s)
        </button>

        <button
          type="button"
          style={{
            flex: 1,
            minWidth: 200,
            background: '#0f2c4d',
          }}
          onClick={() => {
            // stub for "Add Extra Contact" – we’ll later tie into additional_contacts JSON
            alert('Extra contact entry coming soon.')
          }}
        >
          Add Extra Contact
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="primary"
        style={{ width: '100%', marginTop: 10 }}
      >
        {loading ? 'Saving…' : 'Submit'}
      </button>

      {statusMsg === 'success' && (
        <p style={{ color: 'green', marginTop: 8 }}>Lead saved ✅</p>
      )}
      {statusMsg === 'error' && (
        <p style={{ color: 'red', marginTop: 8 }}>
          Something went wrong. Check console / Supabase settings.
        </p>
      )}
    </form>
  </>

  {/* EXPANDING BUSINESS PICKER */}
{showBusinessPicker && (
  <div
    style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      top: '30%',
      background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      zIndex: 60,
    }}
    onClick={() => setShowBusinessPicker(false)}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 820,
        margin: '0 auto',
        background: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        boxShadow: '0 -10px 24px rgba(15,23,42,0.25)',
        padding: 16,
        maxHeight: '70%',
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 40,
          height: 4,
          borderRadius: 999,
          background: '#e5e7eb',
          margin: '0 auto 8px',
        }}
      />

      <h2 style={{ marginTop: 4, marginBottom: 8, fontSize: '1rem' }}>
        Nearby Businesses
      </h2>

      {loadingBusinesses && <p>Searching nearby…</p>}
      {!loadingBusinesses && businesses.length === 0 && (
        <p className="helper">{businessError || 'No nearby businesses found.'}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {businesses.map((biz) => {
          const isActive =
            selectedBusiness && selectedBusiness.place_id === biz.place_id

          return (
            <div
              key={biz.place_id}
              style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: isActive ? '#e5f0ff' : '#f9fafb',
                padding: 8,
              }}
            >
              {/* Row header */}
              <button
                type="button"
                onClick={() => setSelectedBusiness(isActive ? null : biz)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  boxShadow: 'none',
                  padding: 4,
                  fontSize: '0.9rem',
                  color: 'var(--ink)',
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {biz.name || biz.address}
                </div>
                {biz.address && (
                  <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                    {biz.address}
                  </div>
                )}
              </button>

              {/* EXPANDED DETAILS */}
              {isActive && (
                <div
                  style={{
                    marginTop: 6,
                    borderTop: '1px solid #e5e7eb',
                    paddingTop: 6,
                    fontSize: '0.82rem',
                  }}
                >
                  {(biz.rating || biz.category || biz.openNow) && (
                    <div style={{ color: '#4b5563', marginBottom: 4 }}>
                      {biz.rating && (
                        <>
                          ⭐ {biz.rating.toFixed(1)}
                          {biz.ratingCount ? ` (${biz.ratingCount})` : ''}
                        </>
                      )}
                    </div>
                  )}

                  {(biz.phone || biz.website) && (
                    <div style={{ color: '#4b5563', marginBottom: 4 }}>
                      {biz.phone}
                      {biz.phone && biz.website && ' • '}
                      {biz.website?.replace(/^https?:\/\//, '')}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectBusiness(biz)
                      setShowBusinessPicker(false)
                    }}
                    style={{
                      width: '100%',
                      marginTop: 8,
                      minHeight: 40,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      borderRadius: 999,
                      background: 'var(--navy)',
                      color: '#fff',
                      boxShadow: 'var(--shadow)',
                    }}
                  >
                    Use this business
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowBusinessPicker(false)}
        style={{
          width: '100%',
          marginTop: 12,
          minHeight: 40,
          fontSize: '0.9rem',
        }}
      >
        Close
      </button>
    </div>
  </div>
)}

) : isAdmin ? (
  // ... existing AdminOptions block
              <AdminOptions
                organizationId={organizationId || DEFAULT_ORGANIZATION_ID}
                statusOptions={statusOptions}
                ratingOptions={ratingOptions}
                industryOptions={industryOptions}
                reloadOptions={loadOptionLists}
              />
            ) : (
              <p>You don&apos;t have access to admin settings.</p>
            )}
          </div>
        )}
      </main>
    </>
  )
}

export default App 
