// src/RootApp.jsx
import App from './App.jsx'
import EnterpriseSignup from './EnterpriseSignup.jsx'

export default function RootApp() {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : ''

  const isAdminHost =
    hostname === 'admin.crmforstaffing.com' || hostname.startsWith('admin.')

  return isAdminHost ? <EnterpriseSignup /> : <App />
}
