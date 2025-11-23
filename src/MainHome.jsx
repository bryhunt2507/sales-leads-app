// src/MainHome.jsx
import React, { useState } from 'react'
import './MainHome.css'

export default function MainHome() {
  // Which report view is selected
  const [activeView, setActiveView] = useState('dispatch')

  // Fake calendar items for now – we’ll wire real data later
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

  // Mapping for the main embed card title
  const EMBED_TITLES = {
    dispatch: 'Texas Dispatch Report',
    weekactivity: 'Current Week Activity',
    regional: 'Regional Sales Report',
    activity: 'Regional Sales Activity',
  }

  const embedTitle = EMBED_TITLES[activeView] || 'Texas Dispatch Report'

  return (
    <div id="homeRoot" className="home-grid">
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
          data-tip="Man-out by branch and customer – who is on assignment today."
          onClick={() => setActiveView('dispatch')}
        >
          Texas Dispatch Report
        </button>

        <button
          type="button"
          className={`btn blue ${
            activeView === 'weekactivity' ? 'active' : ''
          }`}
          data-tip="This week’s calls, visits, and emails by sales rep."
          onClick={() => setActiveView('weekactivity')}
        >
          Current Week Activity
        </button>

        <button
          type="button"
          className={`btn blue ${
            activeView === 'regional' ? 'active' : ''
          }`}
          data-tip="Regional rolled-up view – revenue, hours, and key KPIs."
          onClick={() => setActiveView('regional')}
        >
          Regional Sales Report
        </button>

        <button
          type="button"
          className={`btn blue ${
            activeView === 'activity' ? 'active' : ''
          }`}
          data-tip="Activity timeline – calls, visits, quotes, and emails."
          onClick={() => setActiveView('activity')}
        >
          Regional Sales Activity
        </button>

        {/* Flexible spacer pushes action buttons to the right */}
        <div className="btn-spacer" />

        {/* Green action buttons – stubbed for now */}
        <button
          id="btnSendDispatch"
          type="button"
          className="btn green"
          onClick={() => {
            // TODO: hook up your “Send Man-Out Report” flow
            alert('TODO: Send Man-Out Report flow goes here.')
          }}
        >
          Send Man-Out Report
        </button>

        <button
          id="btnDailyReportOpen"
          type="button"
          className="btn green"
          onClick={() => {
            // TODO: hook up your “Send Daily Close Report” flow
            alert('TODO: Send Daily Close Report flow goes here.')
          }}
        >
          Send Daily Close Report
        </button>

        {/* Gold button linking to invoice correction form */}
        <a
          className="btn gold"
          href="https://docs.google.com/forms/d/e/1FAIpQLSeLRpU6yxljoY9TGHeYl86jtTeokDEGi4b-ygK9ZCenEi29PA/viewform"
          target="_blank"
          rel="noreferrer"
          data-tip="Submit changes or issues for invoices already sent."
        >
          Invoice Correction Request
        </a>
      </section>

      {/* ROW 3 – Embed / Report area */}
      <section className="card embed-card" id="embedCard">
        <div className="row between embed-header">
          <h3 id="embedTitle" className="card-title">
            {embedTitle}
          </h3>
          {/* You can drop filters / date range selectors here later */}
        </div>

        <div id="embedWrap" className="embed-wrap">
          {/* 
            Later we can:
            - Render iframes (Supabase reports / Sheets)
            - Render React charts (Supabase data)
            For now this just gives you a clear placeholder.
          */}
          <div className="embed-placeholder">
            <p>
              <strong>{embedTitle}</strong> will be shown here.
            </p>
            <p className="meta">
              This is the CRM homepage scaffold. Next step is wiring this area
              to your real reports (Supabase views, Google Sheets, or PDFs).
            </p>
          </div>
        </div>

        <div id="embedStatus" className="meta embed-status">
          Use the blue buttons above to switch between different report views.
        </div>
      </section>
    </div>
  )
}
