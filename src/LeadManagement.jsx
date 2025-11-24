// src/LeadManagement.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

// Fallback org if nothing is passed in yet
const DEFAULT_ORG_ID = '53f11d6b-1874-479f-9f27-ea3d27787d7f'

function LeadManagement({ organizationId }) {
  const orgId = organizationId || DEFAULT_ORG_ID
  

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          company,
          contact_name,
          contact_email,
          contact_phone,
          status,
          rating,
          industry,
          created_at
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200) // light for now

      if (cancelled) return

      if (error) {
        console.error('Error loading leads for LeadManagement:', error)
        setError('Unable to load leads')
        setLeads([])
      } else {
        setLeads(data || [])
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [orgId, reloadToken])

  // Distinct status / rating values for filters
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(leads.map(l => l.status).filter(Boolean))).sort(),
    [leads],
  )

  const ratingOptions = useMemo(
    () =>
      Array.from(new Set(leads.map(l => l.rating).filter(Boolean))).sort(),
    [leads],
  )

  // Filter + sort in memory
  const processedLeads = useMemo(() => {
    let result = leads

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      result = result.filter(l => {
        return (
          (l.company && l.company.toLowerCase().includes(term)) ||
          (l.contact_name && l.contact_name.toLowerCase().includes(term)) ||
          (l.contact_email && l.contact_email.toLowerCase().includes(term)) ||
          (l.contact_phone && l.contact_phone.toLowerCase().includes(term))
        )
      })
    }

    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter)
    }
    if (ratingFilter !== 'all') {
      result = result.filter(l => l.rating === ratingFilter)
    }

    const sorted = [...result]
    sorted.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1

      if (sortField === 'created_at') {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0
        const db = b.created_at ? new Date(b.created_at).getTime() : 0
        return (da - db) * dir
      }

      const va = (a[sortField] || '').toString().toLowerCase()
      const vb = (b[sortField] || '').toString().toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })

    return sorted
  }, [leads, search, statusFilter, ratingFilter, sortField, sortDir])

  function handleSortClick(field) {
    if (field === sortField) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  return (
    <div
      className="card"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="card-header row between">
        <div>
          <h2 style={{ margin: 0 }}>Lead Management</h2>
          <p className="meta">
            View, sort, and filter your imported leads. Update / email flows
            will come next.
          </p>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setReloadToken(t => t + 1)}
        >
          Refresh
        </button>
      </div>

      <div
        className="card-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Filters */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search company / contact / email / phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 200 }}
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ flex: 1, minWidth: 140 }}
          >
            <option value="all">All statuses</option>
            {statusOptions.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={e => setRatingFilter(e.target.value)}
            style={{ flex: 1, minWidth: 140 }}
          >
            <option value="all">All ratings</option>
            {ratingOptions.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loading ? (
            <p className="meta">Loading leads…</p>
          ) : error ? (
            <p className="meta" style={{ color: '#ef4444' }}>
              {error}
            </p>
          ) : processedLeads.length === 0 ? (
            <p className="meta">No leads match your filters.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortClick('created_at')}>
                    Created{' '}
                    {sortField === 'created_at'
                      ? sortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </th>
                  <th onClick={() => handleSortClick('company')}>
                    Company{' '}
                    {sortField === 'company'
                      ? sortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </th>
                  <th onClick={() => handleSortClick('contact_name')}>
                    Contact{' '}
                    {sortField === 'contact_name'
                      ? sortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th onClick={() => handleSortClick('status')}>
                    Status{' '}
                    {sortField === 'status'
                      ? sortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </th>
                  <th onClick={() => handleSortClick('rating')}>
                    Rating{' '}
                    {sortField === 'rating'
                      ? sortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </th>
                  <th>Industry</th>
                </tr>
              </thead>
              <tbody>
                {processedLeads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>{lead.company || '—'}</td>
                    <td>{lead.contact_name || '—'}</td>
                    <td>{lead.contact_email || '—'}</td>
                    <td>{lead.contact_phone || '—'}</td>
                    <td>{lead.status || '—'}</td>
                    <td>{lead.rating || '—'}</td>
                    <td>{lead.industry || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
export default LeadManagement