// src/EnterpriseSignup.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function EnterpriseSignup() {
  const [companyName, setCompanyName] = useState('')
  const [companyDomain, setCompanyDomain] = useState('')
  const [primaryAdminEmail, setPrimaryAdminEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)

    if (!companyName || !companyDomain || !primaryAdminEmail) {
      setStatus('Please fill in all fields.')
      return
    }

    setLoading(true)

    try {
      // 1) Create company row
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            company_name: companyName,
            primary_domain: companyDomain,
          },
        ])
        .select()
        .single()

      if (companyError) {
        console.error('Company insert error', companyError)
        setStatus('Error creating company. Check console.')
        setLoading(false)
        return
      }

      // 2) Create organization row linked to company
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([
          {
            name: `${companyName} - Main`,
            company_id: company.id,
          },
        ])
        .select()
        .single()

      if (orgError) {
        console.error('Organization insert error', orgError)
        setStatus('Company created, but error creating organization.')
        setLoading(false)
        return
      }

      // 3) Upsert profile for the primary admin
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            email: primaryAdminEmail,
            organization_id: org.id,
            role: 'owner',
          },
          { onConflict: 'email' }
        )

      if (profileError) {
        console.error('Profile upsert error', profileError)
        setStatus('Org created, but error saving admin profile.')
        setLoading(false)
        return
      }

      // 4) Send magic link to primary admin
      const redirectUrl =
        typeof window !== 'undefined' ? window.location.origin : undefined

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: primaryAdminEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })

      if (authError) {
        console.error('Auth magic-link error', authError)
        setStatus(
          'Company & org created, profile saved, but error sending sign-in link.'
        )
        setLoading(false)
        return
      }

      setStatus(
        `Company created and sign-in link sent to ${primaryAdminEmail}.`
      )
      setCompanyName('')
      setCompanyDomain('')
      setPrimaryAdminEmail('')
    } catch (err) {
      console.error('Enterprise setup error', err)
      setStatus('Unexpected error creating company. Check console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          width: '100%',
          background: 'white',
          borderRadius: 32,
          padding: 32,
          boxShadow: '0 24px 60px rgba(15,23,42,0.35)',
        }}
      >
        <h1
          style={{
            fontSize: '2.2rem',
            marginBottom: 8,
            fontWeight: 800,
            color: '#111827',
          }}
        >
          CRM Staffing — Enterprise Setup
        </h1>
        <p style={{ marginBottom: 24, color: '#4b5563' }}>
          Create your company account, set the business email domain, and send a
          secure sign-in link to the first admin user.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Company Name</span>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="LaborMax – Main Branch"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Company Email Domain</span>
            <input
              type="text"
              value={companyDomain}
              onChange={e => setCompanyDomain(e.target.value)}
              placeholder="labormaxstaffing.com"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Primary Admin Email</span>
            <input
              type="email"
              value={primaryAdminEmail}
              onChange={e => setPrimaryAdminEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '12px 18px',
              borderRadius: 999,
              border: 'none',
              background: '#16a34a',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(22,163,74,0.35)',
            }}
          >
            {loading ? 'Creating company…' : 'Create Company & Send Link'}
          </button>

          {status && (
            <p style={{ marginTop: 8, color: '#374151', fontSize: '0.9rem' }}>
              {status}
            </p>
          )}
        </form>

        <p style={{ marginTop: 24, fontSize: '0.85rem', color: '#6b7280' }}>
          You&apos;re on the <code>admin</code> entry point. This page will
          become the full &quot;Create Company + Domain + First Admin&quot;
          flow for multi-tenant accounts.
        </p>
      </div>
    </div>
  )
}
