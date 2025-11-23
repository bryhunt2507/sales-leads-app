// src/MainHome.jsx
import React, { useEffect, useState } from 'react'
import './MainHome.css'

export default function MainHome() {
  const [user] = useState({
    displayName: 'Bryan Hunt',
    email: 'bryan.hunt@labormaxstaffing.com',
  })

  const [kpi, setKpi] = useState(null)

  useEffect(() => {
    // temp mock data – we’ll wire Supabase later
    setKpi({
      todayTotal: 12,
      thisWeekTotal: 48,
      targetTotal: 50,
      buckets: {
        calls: 12,
        visits: 2,
        meetings: 1,
        emails: 3,
      },
    })
  }, [])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="crm-main-root">
      <header className="crm-main-header">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <div className="brand-title">CRM for Staffing</div>
            <div className="brand-subtitle">Texas & Regional Sales Hub</div>
          </div>
        </div>

        <div className="header-right">
          <div className="today-pill">{today}</div>
          <div className="user-chip">
            <div className="user-name">{user.displayName}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      </header>

      <main className="crm-main-content">
        <h2>Welcome, {user.displayName}</h2>
        <p>This is your CRM homepage dashboard.</p>

        {kpi && (
          <div className="kpi-strip">
            <div className="kpi-tile">
              <div className="kpi-label">Calls Today</div>
              <div className="kpi-value">{kpi.todayTotal}</div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-label">This Week / Target</div>
              <div className="kpi-value">
                {kpi.thisWeekTotal} / {kpi.targetTotal}
              </div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-label">Visits Today</div>
              <div className="kpi-value">{kpi.buckets.visits}</div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-label">Fit Meetings</div>
              <div className="kpi-value">{kpi.buckets.meetings}</div>
            </div>

            <div className="kpi-tile">
              <div className="kpi-label">Emails Today</div>
              <div className="kpi-value">{kpi.buckets.emails}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
