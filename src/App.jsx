// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import AdminOptions from './AdminOptions.jsx'
import MainHome from './MainHome.jsx'
import SalesEntryForm from './SalesEntryForm.jsx'

// Fallback org if nothing is resolved from profile yet
const DEFAULT_ORG_ID = '53f11d6b-1874-479f-9f27-ea3d27787d7f'

function App() {
  // Auth / profile / organization
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organizationId, setOrganizationId] = useState(DEFAULT_ORG_ID)
  const [authLoading, setAuthLoading] = useState(true)

  // Top-level app view
  // 'home'  => CRM Main (MainHome.jsx: Home / Sales / Recruiting / Tasks / Reports)
  // 'entry' => Sales Activity Entry (phone app replacement)
  // 'admin' => dropdown option management
  const [view, setView] = useState('home')

  // Options from lookup tables (scoped by organization_id)
  const [statusOptions, setStatusOptions] = useState([])
  const [ratingOptions, setRatingOptions] = useState([])
  const [industryOptions, setIndustryOptions] = useState([])
  const [buyingRoleOptions, setBuyingRoleOptions] = useState([])
  const [callTypeOptions, setCallTypeOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [statusMsg, setStatusMsg] = useState(null)

  const isAdmin =
    profile?.role === 'owner' ||
    profile?.role === 'admin'

  // ---- AUTH / SESSION ----
  useEffect(() => {
    let ignore = false

    async function loadSession() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          console.error('Error getting user', error)
        }

        if (!ignore) {
          setAuthUser(user || null)
          setAuthLoading(false)
        }
      } catch (err) {
        console.error('Unexpected error getting user', err)
        if (!ignore) setAuthLoading(false)
      }
    }

    loadSession()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null)
      },
    )

    return () => {
      ignore = true
      subscription?.subscription?.unsubscribe?.()
    }
  }, [])

  // ---- LOAD PROFILE + ORG FROM profiles TABLE ----
  useEffect(() => {
    if (!authUser?.email) return
    let ignore = false

    async function loadProfile() {
      try {
        const { data: profileRow, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle()

        if (error) {
          console.error('Error loading profile', error)
        }

        if (!ignore && profileRow) {
          setProfile(profileRow)
          if (profileRow.organization_id) {
            setOrganizationId(profileRow.organization_id)
          } else if (profileRow.company_id) {
            // you can extend this later to map company -> default org
            setOrganizationId(DEFAULT_ORG_ID)
          }
        }
      } catch (err) {
        console.error('Unexpected error loading profile', err)
      }
    }

    loadProfile()
    return () => {
      ignore = true
    }
  }, [authUser])

  // ---- LOAD OPTION TABLES FOR CURRENT ORG ----
  async function loadOptionLists(orgId) {
    if (!orgId) return
    setLoadingOptions(true)
    setStatusMsg(null)

    try {
      const [statusRes, ratingRes, industryRes, buyingRes, callTypeRes] =
        await Promise.all([
          supabase
            .from('call_status_options')
            .select('*')
            .eq('organization_id', orgId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('rating_options')
            .select('*')
            .eq('organization_id', orgId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('industry_options')
            .select('*')
            .eq('organization_id', orgId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('buying_role_options')
            .select('*')
            .eq('organization_id', orgId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('call_type_options')
            .select('*')
            .eq('organization_id', orgId)
            .eq('active', true)
            .order('sort_order', { ascending: true }),
        ])

      if (statusRes.error) console.error('Status options error:', statusRes.error)
      if (ratingRes.error) console.error('Rating options error:', ratingRes.error)
      if (industryRes.error) console.error('Industry options error:', industryRes.error)
      if (buyingRes.error) console.error('Buying role options error:', buyingRes.error)
      if (callTypeRes.error) console.error('Call type options error:', callTypeRes.error)

      console.log('Loaded options:', {
        status: statusRes.data?.length || 0,
        rating: ratingRes.data?.length || 0,
        industry: industryRes.data?.length || 0,
        buying: buyingRes.data?.length || 0,
        callType: callTypeRes.data?.length || 0,
      })

      setStatusOptions(statusRes.data || [])
      setRatingOptions(ratingRes.data || [])
      setIndustryOptions(industryRes.data || [])
      setBuyingRoleOptions(buyingRes.data || [])
      setCallTypeOptions(callTypeRes.data || [])
    } catch (err) {
      console.error('Error loading option lists', err)
      setStatusMsg('Error loading dropdown options.')
    } finally {
      setLoadingOptions(false)
    }
  }

  useEffect(() => {
    if (!organizationId) return
    loadOptionLists(organizationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  // ---- HANDLERS ----
  const handleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuthUser(null)
    setProfile(null)
    setOrganizationId(DEFAULT_ORG_ID)
  }

  // ---- RENDER ----
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading session…</p>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">CRM Staffing Sales</h1>
        <button
          type="button"
          onClick={handleSignIn}
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <>
      {/* HEADER (uses index.css styles) */}
      <header>
        <div className="header-inner">
          <div className="brand">
            <div className="brand-logo" />
            <span>CRM Staffing Sales</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="user-badge">
              {authUser.email}
              {profile?.role ? ` • ${profile.role}` : ''}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              style={{ background: '#0b2138' }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Top nav buttons inside the header */}
        <div
          className="header-inner"
          style={{
            justifyContent: 'center',
            gap: 8,
            paddingTop: 4,
            paddingBottom: 6,
          }}
        >
          <button
            type="button"
            onClick={() => setView('home')}
            style={{
              background: view === 'home' ? '#ffffff22' : 'transparent',
              borderRadius: 9999,
              padding: '6px 10px',
              fontSize: '0.8rem',
              boxShadow: 'none',
            }}
          >
            CRM Main
          </button>

          <button
            type="button"
            onClick={() => setView('entry')}
            style={{
              background: view === 'entry' ? '#ffffff22' : 'transparent',
              borderRadius: 9999,
              padding: '6px 10px',
              fontSize: '0.8rem',
              boxShadow: 'none',
            }}
          >
            Sales Entry
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setView('admin')}
              style={{
                background: view === 'admin' ? '#ffffff22' : 'transparent',
                borderRadius: 9999,
                padding: '6px 10px',
                fontSize: '0.8rem',
                boxShadow: 'none',
              }}
            >
              Admin
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT (uses main + .card from index.css) */}
      <main>
        <div className="card">
          {statusMsg && (
            <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded">
              {statusMsg}
            </div>
          )}

          {loadingOptions && (
            <div className="mb-3 text-xs text-gray-600">
              Loading dropdown options…
            </div>
          )}

          {view === 'home' && (
            <MainHome organizationId={organizationId} />
          )}

          {view === 'entry' && (
            <SalesEntryForm
              organizationId={organizationId}
              currentUserId={authUser?.id}
              statusOptions={statusOptions}
              ratingOptions={ratingOptions}
              industryOptions={industryOptions}
              buyingRoleOptions={buyingRoleOptions}
              callTypeOptions={callTypeOptions}
            />
          )}

          {view === 'admin' && (
  isAdmin ? (
    <AdminOptions organizationId={organizationId} />
  ) : (
    <p>You don&apos;t have access to admin settings.</p>
  )
)}

        </div>
      </main>
    </>
  )
}

export default App
