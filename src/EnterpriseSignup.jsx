// src/EnterpriseSignup.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function EnterpriseSignup() {
  const [companyName, setCompanyName] = useState('')
  const [domain, setDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!companyName || !domain || !adminEmail) {
      setMessage('Please fill in all fields.')
      return
    }

    const cleanDomain = domain.replace('@', '').trim().toLowerCase()

    if (!adminEmail.toLowerCase().endsWith(`@${cleanDomain}`)) {
      setMessage(`Admin email must use the ${cleanDomain} domain.`)
      return
    }

    setLoading(true)

    // 1. Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([{ company_name: companyName, primary_domain: cleanDomain }])
      .select()
      .single()

    if (companyError) {
      console.error(companyError)
      setMessage('Error creating company.')
      setLoading(false)
      return
    }

    // 2. Create a default organization for this company
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert([
        {
          company_id: company.id,
          name: `${companyName} - Main`,
        },
      ])
      .select()
      .single()

    if (orgError) {
      console.error(orgError)
      setMessage('Company created, but error creating organization.')
      setLoading(false)
      return
    }

    // 3. Send magic link to the owner
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: adminEmail,
    })

    // 4. Save profile / owner role
    const { error: profileError } = await supabase.from('profiles').upsert(
      [
        {
          email: adminEmail,
          role: 'owner', // enterprise-level role
          company_id: company.id,
          organization_id: org.id,
        },
      ],
      { onConflict: 'email', returning: 'minimal' }
    )

    if (authError) {
      console.error(authError)
      setMessage('Error sending sign-in link.')
    } else if (profileError) {
      console.error(profileError)
      setMessage('Sign-in link sent, but error saving profile.')
    } else {
      setMessage('✅ Company created and sign-in link sent to the owner.')
      setCompanyName('')
      setDomain('')
      setAdminEmail('')
    }

    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: 12 }}>
          CRM Staffing – Enterprise Setup
        </h1>
        <p className="helper" style={{ textAlign: 'center' }}>
          Create your company account, set the business domain, and send a secure
          sign-in link to the first admin user.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <label>
            Company Name
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="LaborMax Staffing"
            />
          </label>

          <label>
            Company Email Domain
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="labormaxstaffing.com"
            />
          </label>

          <label>
            Primary Admin Email
            <input
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="owner@labormaxstaffing.com"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="primary"
            style={{ width: '100%', marginTop: 20 }}
          >
            {loading ? 'Creating…' : 'Create Company & Send Link'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, fontSize: '0.9rem' }}>{message}</p>
        )}
      </div>
    </main>
  )
}
