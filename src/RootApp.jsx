// src/RootApp.jsx
import App from './App.jsx'
import EnterpriseSignup from './EnterpriseSignup.jsx'

export default function RootApp() {
  const host = window.location.hostname
  const isAdminHost = host.startsWith('admin.')

  if (isAdminHost) {
    // admin.crmforstaffing.com
    return <EnterpriseSignup />
  }

  // app.crmforstaffing.com (and any other host)
  return <App />
}
