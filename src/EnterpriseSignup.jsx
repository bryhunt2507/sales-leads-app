// src/EnterpriseSignup.jsx

export default function EnterpriseSignup() {
  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: 16 }}>
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: 12 }}>
          CRM Staffing – Enterprise Setup
        </h1>
        <p className="helper">
          You&apos;re on the <strong>admin</strong> entry point.
          This page will become the &quot;Create Company + Domain + First Admin&quot; flow.
        </p>

        <p style={{ marginTop: 16 }}>
          For now this is just a test screen so we can confirm that
          <code>admin.crmforstaffing.com</code> is loading something
          different than <code>app.crmforstaffing.com</code>.
        </p>
      </div>
    </main>
  )
}
