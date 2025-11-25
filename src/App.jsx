// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import AdminOptions from './AdminOptions.jsx'
import MainHome from './MainHome.jsx'
import LeadManagement from './LeadManagement.jsx'
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
  // 'home' => dashboard shell with Sales / Recruiting / Tasks / Reports tabs
  // 'entry' => Sales Activity Entry (phone app replacement)
  // 'sales' => Lead management list
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
            .order('sort_order', { ascending: true }),
          supabase
            .from('rating_options')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('industry_options')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('buying_role_options')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('call_type_options')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true }),
        ])

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
        <h1 className="text-2xl font-semibold">CRM for Staffing</h1>
        <button
          type="button"
          onClick={handleSignIn}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium"
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <>
      {/* TOP BAR */}
      <header className="w-full border-b bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-semibold">CRM for Staffing</span>
            {organizationId && (
              <span className="text-xs text-gray-500">
                Org: {organizationId.slice(0, 8)}…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              {authUser.email}
              {profile?.role ? ` • ${profile.role}` : ''}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2 py-1 rounded border text-xs"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* NAV TABS */}
      <nav className="w-full border-b bg-slate-50">
        <div className="max-w-6xl mx-auto flex gap-3 px-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => setView('home')}
            className={`px-3 py-1 rounded-full ${
              view === 'home' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setView('entry')}
            className={`px-3 py-1 rounded-full ${
              view === 'entry' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Sales Entry
          </button>
          <button
            type="button"
            onClick={() => setView('sales')}
            className={`px-3 py-1 rounded-full ${
              view === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Lead Management
          </button>
          <button
            type="button"
            onClick={() => setView('admin')}
            className={`px-3 py-1 rounded-full ${
              view === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-700'
            }`}
          >
            Admin
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-4 py-4">
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

        {view === 'home' && <MainHome organizationId={organizationId} />}

        {view === 'entry' && (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <SalesEntryForm
              organizationId={organizationId}
              currentUserId={authUser?.id}
              statusOptions={statusOptions}
              ratingOptions={ratingOptions}
              industryOptions={industryOptions}
              buyingRoleOptions={buyingRoleOptions}
              callTypeOptions={callTypeOptions}
            />
          </div>
        )}

        {view === 'sales' && (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <LeadManagement organizationId={organizationId} />
          </div>
        )}

        {view === 'admin' && (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <AdminOptions
              organizationId={organizationId}
              statusOptions={statusOptions}
              ratingOptions={ratingOptions}
              industryOptions={industryOptions}
              reloadOptions={() => loadOptionLists(organizationId)}
            />
          </div>
        )}
      </main>
    </>
  )
}

export default App
