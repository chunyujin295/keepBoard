import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StatsApp from './StatsApp'
import './index.css'

const root = document.getElementById('root')!

// Single HTML entry, two routes: the pet window loads with no hash, the stats
// window loads `#stats` (plus a `?panel=daily|weekly` query). This keeps both
// windows in one build instead of adding a second Vite entry.
if (location.hash.startsWith('#stats')) {
  const panel = new URLSearchParams(location.search).get('panel') === 'weekly' ? 'weekly' : 'daily'
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StatsApp panel={panel} />
    </React.StrictMode>
  )
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
