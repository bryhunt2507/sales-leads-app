// src/MainHome.jsx
import React, { useState } from 'react'
import './MainHome.css'

export default function MainHome({ organizationId }) {

  // Top-level CRM sections (tabs)
  const [section, setSection] = useState('home') // 'home' | 'sales' | 'recruiting' | 'tasks' | 'reports'

  // Which report view is selected inside Home
  const [activeView, setActiveView] = useState('dispatch')

  // Fake calendar items for now – wire real data later
  const calendarItems = [
    {
      time: '9:00 AM',
      title: 'Call: ABC Manufacturing',
      meta: 'Prospect follow-up · 30 min',
    },
    {
      time: '11:30 AM',
      title: 'Visit: Lone Star Concrete',
      meta: 'On-site visit · 1 hr',
    },
    {
      time: '3:00 PM',
      title: 'Teams: Regional Sales Huddle',
      meta: 'Internal · 45 min',
    },
  ]

  const EMBED_TITLES = {
    dispatch: 'Texas Dispatch Report',
    weekactivity: 'Current Week Activity',
    regional: 'Regional Sales Report',
    activity: 'Regional Sales Activity',
  }

  const embedTitle = EMBED_TITLES[activeView] || 'Texas Dispatch Report'

  // ---------- RENDER HELPERS ----------

  function renderHomeSection() {
    return (
      <>
        {/* CARD 1 – Today’s Calendar */}
        <section className="card cal-card">
          <div className="row between">
            <div>
              <h2 className="card-title">Today’s Calendar</h2>
              <div id="calSub" className="meta">
                Your upcoming calls, visits, and meetings.
              </div>
            </div>
            <div className="actions">
              <a
                id="openCal"
                className="link-btn"
                href="https://calendar.google.com/calendar/u/0/r/day"
                target="_blank"
                rel="noreferrer"
              >
                Open Calendar
              </a>
            </div>
          </div>

          <ul id="calList" className="cal-list">
            {calendarItems.length === 0 ? (
              <li className="empty">No calendar events for today.</li>
            ) : (
              calendarItems.map((item, idx) => (
                <li key={idx} className="cal-item">
                  <div className="cal-when">{item.time}</div>
                  <div className="cal-main">
                    <div className="cal-title">{item.title}</div>
                    <div className="cal-meta">{item.meta}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* ROW 2 – Toolbar: report views + actions */}
        <section id="homeToolbar" className="btn-row">
          {/* Blue report-view buttons */}
          <button
            type="button"
            className={`btn blue ${
              activeView === 'dispatch' ? 'active' : ''
            }`}
            onClick={() => setActiveView('dispatch')}
          >
            Texas Dispatch
          </button>

          <button
            type="button"
            className={`btn blue ${
              activeView === 'weekactivity' ? 'active' : ''
            }`}
            onClick={() => setActiveView('weekactivity')}
          >
            Week Activity
          </button>

          <button
            type="button"
            className={`btn blue ${
              activeView === 'regional' ? 'active' : ''
            }`}
            onClick={() => setActiveView('regional')}
          >
            Regional Sales
          </button>

          <button
            type="button"
            className={`btn blue ${
              activeView === 'activity' ? 'active' : ''
            }`}
            onClick={() => setActiveView('activity')}
          >
            Activity Timeline
          </button>

          {/* Spacer pushes actions to the right */}
          <div className="btn-spacer" />

          {/* Green action buttons – stubs for now */}
          <button
            id="btnSendDispatch"
            type="button"
            className="btn green"
            onClick={() => {
              alert('TODO: Send Man-Out Report flow goes here.')
            }}
          >
            Send Man-Out
          </button>

          <button
            id="btnDailyReportOpen"
            type="button"
            className="btn green"
            onClick={() => {
              alert('TODO: Send Daily Close Report flow goes here.')
            }}
          >
            Send Daily Close
          </button>

          {/* Gold button linking to invoice correction form */}
          <a
            className="btn gold"
            href="https://docs.google.com/forms/d/e/1FAIpQLSeLRpU6yxljoY9TGHeYl86jtTeokDEGi4b-ygK9ZCenEi29PA/viewform"
            target="_blank"
            rel="noreferrer"
          >
            Invoice Correction
          </a>
        </section>

        {/* ROW 3 – Embed / Report area */}
        <section className="card embed-card" id="embedCard">
          <div className="row between embed-header">
            <h3 id="embedTitle" className="card-title">
              {embedTitle}
            </h3>
            {/* future filters go here (date range, branch, rep, etc.) */}
          </div>

          <div id="embedWrap" className="embed-wrap">
            <div className="embed-placeholder">
              <p>
                <strong>{embedTitle}</strong> will be shown here.
              </p>
              <p className="meta">
                This is the CRM homepage scaffold. Next step is wiring this
                area to your real reports (Supabase views, Google Sheets, or
                PDFs).
              </p>
            </div>
          </div>

          <div id="embedStatus" className="meta embed-status">
            Use the toolbar above to switch between views and actions.
          </div>
        </section>
      </>
    )
  }

  function renderSalesSection() {
    return (
      <section className="card big-card">
        <h2 className="card-title">Sales Workspace</h2>
        <p className="meta">
          This is where we’ll stack sales dashboards, pipeline, and your phone
          app lead entry like a NetSuite-style bundle.
        </p>
        <ul className="bullet-list">
          <li>Sales pipeline by stage</li>
          <li>Key accounts & opportunities</li>
          <li>Lead entry / call logging (phone app embed)</li>
        </ul>
      </section>
    )
  }

  function renderRecruitingSection() {
    return (
      <section className="card big-card">
        <h2 className="card-title">Recruiting Workspace</h2>
        <p className="meta">
          This area will handle candidates, job orders, and submittals.
        </p>
        <ul className="bullet-list">
          <li>Open job orders & priority roles</li>
          <li>Candidate pipelines (applied → interviewed → placed)</li>
          <li>Compliance items (I-9, onboarding, certs)</li>
        </ul>
      </section>
    )
  }

  function renderTasksSection() {
    return (
      <section className="card big-card">
        <h2 className="card-title">Tasks & Follow-Ups</h2>
        <p className="meta">
          This will become your stacked task manager: calls, visits, quotes,
          and follow-ups across Sales + Recruiting.
        </p>
        <ul className="bullet-list">
          <li>Today&apos;s tasks and overdue follow-ups</li>
          <li>Task queues by rep, customer, or candidate</li>
          <li>Integration with Google Calendar & notifications</li>
        </ul>
      </section>
    )
  }

  function renderReportsSection() {
    return (
      <section className="card big-card">
        <h2 className="card-title">Reporting Hub</h2>
        <p className="meta">
          Central hub for sales, recruiting, and financial reports — NetSuite
          style stacking for staffing.
        </p>
        <ul className="bullet-list">
          <li>Sales & margin by branch, rep, customer</li>
          <li>Recruiting funnel conversion metrics</li>
          <li>Custom dashboards per organization</li>
        </ul>
      </section>
    )
  }

  let content
  switch (section) {
    case 'home':
      content = renderHomeSection()
      break
    case 'sales':
      content = renderSalesSection()
      break
    case 'recruiting':
      content = renderRecruitingSection()
      break
    case 'tasks':
      content = renderTasksSection()
      break
    case 'reports':
      content = renderReportsSection()
      break
    default:
      content = renderHomeSection()
  }

  return (
    <div id="homeRoot" className="home-grid">
      {/* TOP CRM NAV FOR DESKTOP – fills the screen */}
      <nav className="crm-top-tabs">
        <button
          type="button"
          className={`top-tab ${section === 'home' ? 'active' : ''}`}
          onClick={() => setSection('home')}
        >
          Home
        </button>
        <button
          type="button"
          className={`top-tab ${section === 'sales' ? 'active' : ''}`}
          onClick={() => setSection('sales')}
        >
          Sales
        </button>
        <button
          type="button"
          className={`top-tab ${section === 'recruiting' ? 'active' : ''}`}
          onClick={() => setSection('recruiting')}
        >
          Recruiting
        </button>
        <button
          type="button"
          className={`top-tab ${section === 'tasks' ? 'active' : ''}`}
          onClick={() => setSection('tasks')}
        >
          Tasks
        </button>
        <button
          type="button"
          className={`top-tab ${section === 'reports' ? 'active' : ''}`}
          onClick={() => setSection('reports')}
        >
          Reports
        </button>
      </nav>

      {/* MAIN CONTENT AREA – fills desktop width/height */}
      <div className="home-content">{content}</div>
    </div>
  )
}
