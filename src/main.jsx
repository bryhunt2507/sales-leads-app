// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import RootApp from './RootApp.jsx'   // <-- use the wrapper instead of App
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)
