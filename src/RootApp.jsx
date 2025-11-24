// src/RootApp.jsx
import App from './App.jsx'
import EnterpriseSignup from './EnterpriseSignup.jsx'

export default function RootApp() {
  const host =
    typeof window !== 'undefined' ? window.location.host.toLowerCase() : ''

  const isAdminSubdomain = host.startsWith('admin.')

  if (isAdminSubdomain) {
    // admin.crmforstaffing.com → enterprise setup screen
    return <EnterpriseSignup />
  }

  // everything else (app.crmforstaffing.com, localhost) → normal app
  return <App />
}
