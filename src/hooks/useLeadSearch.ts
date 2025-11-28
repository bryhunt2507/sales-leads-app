// src/hooks/useLeadSearch.ts
import { useState } from 'react'
import { searchLeads, Lead } from '../services/leadService'

export function useLeadSearch(organizationId?: string) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const searchTerm = term.trim()
    if (!organizationId || !searchTerm) return

    setLoading(true)
    setError(null)
    try {
      const data = await searchLeads(organizationId, searchTerm)
      setResults(data)
    } catch (err: any) {
      console.error('Search leads error', err)
      setError(err.message || 'Error searching leads.')
    } finally {
      setLoading(false)
    }
  }

  return { term, setTerm, results, loading, error, runSearch }
}
