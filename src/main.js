import './style.css'

const API_KEY = import.meta.env.VITE_METOFFICE_API_KEY
const USE_PROXY = import.meta.env.VITE_USE_PROXY === 'true'
const METOFFICE_BASE = USE_PROXY
  ? '/metoffice'
  : 'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point'
const POSTCODE_API = 'https://api.postcodes.io/postcodes/'
const ALERT_THRESHOLD = 45 // mph
const AMBER_THRESHOLD = 35 // mph

const PROPERTIES = [
  { name: 'Saltram House', postcode: 'PL7 1UH' },
  { name: 'Cotehele', postcode: 'PL12 6TA' },
]

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">Met Office DataHub</p>
        <h1>Wind Gust Monitor</h1>
        <p class="lede">
          Check current, forecast, and recent gusts for any UK postcode. Alerts highlight gusts above 45&nbsp;mph.
        </p>
      </div>
      <form id="postcode-form" class="search">
        <label for="property" class="sr-only">Property</label>
        <select id="property" name="property" required>
          <option value="">Select a property...</option>
          ${PROPERTIES.map(p => `<option value="${p.postcode}">${p.name}</option>`).join('')}
        </select>
        <button type="submit">Check wind</button>
      </form>
    </header>

    <section id="status" class="status info">Select a property to begin.</section>

    <section class="grid">
      <article class="card">
        <header class="card-header">
          <div>
            <p class="label">Current gust</p>
            <h3 id="current-gust">--</h3>
          </div>
          <span id="current-badge" class="badge">Waiting</span>
        </header>
        <p id="current-time" class="muted">No data yet</p>
      </article>

      <article class="card">
        <header class="card-header">
          <div>
            <p class="label">Location</p>
            <h3 id="location-name">--</h3>
          </div>
          <span class="badge neutral">From DataHub</span>
        </header>
        <p id="location-meta" class="muted">Coordinates will appear after search.</p>
      </article>
    </section>

    <section class="card">
      <header class="card-header">
        <div>
          <p class="label">Forecast (next 5 days)</p>
          <h2>Timeline</h2>
        </div>
      </header>
      <div id="forecast-list" class="timeline empty">No forecast loaded.</div>
    </section>

    <section class="card">
      <header class="card-header">
        <div>
          <p class="label">Historical (last 48 hours)</p>
          <h2>Observed gusts</h2>
        </div>
      </header>
      <div id="history-list" class="timeline empty">No observations loaded.</div>
    </section>
  </main>
`

const form = document.querySelector('#postcode-form')
const statusEl = document.querySelector('#status')
const forecastList = document.querySelector('#forecast-list')
const historyList = document.querySelector('#history-list')
const locationNameEl = document.querySelector('#location-name')
const locationMetaEl = document.querySelector('#location-meta')
const currentGustEl = document.querySelector('#current-gust')
const currentBadgeEl = document.querySelector('#current-badge')
const currentTimeEl = document.querySelector('#current-time')

function setStatus(message, tone = 'info') {
  statusEl.textContent = message
  statusEl.className = `status ${tone}`
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

function gustSeverity(gust) {
  if (gust === null || gust === undefined || Number.isNaN(gust)) return 'neutral'
  if (gust >= ALERT_THRESHOLD) return 'danger'
  if (gust >= AMBER_THRESHOLD) return 'amber'
  return 'safe'
}

function gustLabel(gust) {
  const value = gust !== undefined && gust !== null ? gust.toFixed(0) : '--'
  const unit = gust !== undefined && gust !== null ? ' mph' : ''
  return `${value}${unit}`
}

function extractTimeSeries(data) {
  return data?.features?.[0]?.properties?.timeSeries || []
}

function extractLocationName(data, fallback) {
  const fromApi =
    data?.features?.[0]?.properties?.location?.name ||
    data?.features?.[0]?.properties?.nearestTown ||
    data?.features?.[0]?.properties?.siteName
  return fromApi || fallback
}

function findGustValue(entry) {
  if (!entry || typeof entry !== 'object') return null
  const key = Object.keys(entry).find((k) => k.toLowerCase().includes('gust'))
  return key ? Number(entry[key]) : null
}

function renderCurrent(entry) {
  const gust = findGustValue(entry)
  currentGustEl.textContent = gustLabel(gust)
  currentBadgeEl.className = `badge ${gustSeverity(gust)}`
  currentBadgeEl.textContent =
    gustSeverity(gust) === 'danger'
      ? 'Alert'
      : gustSeverity(gust) === 'amber'
        ? 'Watch'
        : 'OK'
  currentTimeEl.textContent = entry?.time ? `Valid at ${formatDate(entry.time)}` : 'Time not provided'
}

function renderForecast(series) {
  if (!series.length) {
    forecastList.classList.add('empty')
    forecastList.textContent = 'No forecast data available.'
    return
  }
  
  const warnings = series.filter((item) => {
    const gust = findGustValue(item)
    return gust >= ALERT_THRESHOLD
  })
  
  if (!warnings.length) {
    forecastList.classList.add('empty')
    forecastList.textContent = 'No warnings of high wind in the next 5 days.'
    return
  }
  
  forecastList.classList.remove('empty')
  forecastList.innerHTML = warnings
    .map((item) => {
      const gust = findGustValue(item)
      return `
        <div class="timeline-row danger">
          <div>
            <p class="muted">${formatDate(item.time)}</p>
            <strong>${gustLabel(gust)}</strong>
          </div>
          <span class="pill danger">45mph+</span>
        </div>
      `
    })
    .join('')
}

function renderHistory(series) {
  if (!series.length) {
    historyList.classList.add('empty')
    historyList.textContent = 'No observations in the last 48 hours.'
    return
  }
  
  const warnings = series.filter((item) => {
    const gust = findGustValue(item)
    return gust >= ALERT_THRESHOLD
  })
  
  if (!warnings.length) {
    historyList.classList.add('empty')
    historyList.textContent = 'No high wind warnings in the last 48 hours.'
    return
  }
  
  historyList.classList.remove('empty')
  historyList.innerHTML = warnings
    .map((item) => {
      const gust = findGustValue(item)
      return `
        <div class="timeline-row danger">
          <div>
            <p class="muted">${formatDate(item.time)}</p>
            <strong>${gustLabel(gust)}</strong>
          </div>
          <span class="pill danger">45mph+</span>
        </div>
      `
    })
    .join('')
}

async function lookupPostcode(postcode) {
  const trimmed = postcode.trim()
  const res = await fetch(`${POSTCODE_API}${encodeURIComponent(trimmed)}`)
  if (!res.ok) {
    throw new Error('Could not look up postcode. Check the value and try again.')
  }
  const payload = await res.json()
  if (payload.status !== 200 || !payload.result) {
    throw new Error('Invalid postcode. Please provide a UK postcode.')
  }
  const { latitude, longitude, country, region, admin_district: district, postcode: formatted } = payload.result
  return {
    latitude,
    longitude,
    label: [formatted, district, region, country].filter(Boolean).join(', '),
  }
}

async function fetchForecast(latitude, longitude) {
  const url = `${METOFFICE_BASE}/three-hourly?latitude=${latitude}&longitude=${longitude}&includeLocationName=true`
  const headers = {
    accept: 'application/json',
  }
  if (!USE_PROXY) {
    headers['apikey'] = API_KEY
  }
  const res = await fetch(url, { headers })
  if (res.status === 401) throw new Error('Unauthorised: check your Met Office API key.')
  if (res.status === 429) throw new Error('Rate limit reached (360 calls/day on free tier). Try later.')
  if (!res.ok) throw new Error('Failed to fetch forecast data.')
  return res.json()
}

async function fetchObservations(latitude, longitude) {
  const end = new Date()
  const start = new Date(end.getTime() - 48 * 60 * 60 * 1000)
  const url = `${METOFFICE_BASE}/hourly?latitude=${latitude}&longitude=${longitude}&includeLocationName=true`
  const headers = {
    accept: 'application/json',
  }
  if (!USE_PROXY) {
    headers['apikey'] = API_KEY
  }
  const res = await fetch(url, { headers })
  if (res.status === 401) throw new Error('Unauthorised: check your Met Office API key.')
  if (res.status === 429) throw new Error('Rate limit reached (360 calls/day on free tier). Try later.')
  if (!res.ok) throw new Error('Failed to fetch observation data.')
  return res.json()
}

function filterForecastWindow(series) {
  const now = Date.now()
  const limit = now + 5 * 24 * 60 * 60 * 1000
  return series.filter((item) => {
    const ts = new Date(item.time).getTime()
    return ts >= now && ts <= limit
  })
}

function nearestToNow(series) {
  const now = Date.now()
  return series.reduce(
    (best, current) => {
      const currentTs = new Date(current.time).getTime()
      const distance = Math.abs(currentTs - now)
      if (distance < best.distance) return { entry: current, distance }
      return best
    },
    { entry: series[0], distance: Infinity },
  ).entry
}

async function handleSearch(event) {
  event.preventDefault()
  if (!API_KEY) {
    setStatus('Missing API key. Add VITE_METOFFICE_API_KEY to your environment.', 'danger')
    return
  }

  const postcode = new FormData(form).get('property')
  if (!postcode || !postcode.trim()) {
    setStatus('Please select a property.', 'danger')
    return
  }

  setStatus('Looking up postcode and fetching gust data…', 'info')
  form.querySelector('button').disabled = true

  try {
    const geo = await lookupPostcode(postcode)
    locationMetaEl.textContent = `Lat: ${geo.latitude.toFixed(4)}, Lon: ${geo.longitude.toFixed(4)}`

    const [forecastData, obsData] = await Promise.all([
      fetchForecast(geo.latitude, geo.longitude),
      fetchObservations(geo.latitude, geo.longitude),
    ])

    const location = extractLocationName(forecastData, geo.label)
    locationNameEl.textContent = location

    const forecastSeries = filterForecastWindow(extractTimeSeries(forecastData))
    const historySeries = extractTimeSeries(obsData)

    renderForecast(forecastSeries)
    renderHistory(historySeries)

    const currentEntry =
      forecastSeries.length > 0 ? nearestToNow(forecastSeries) : historySeries.at(-1) || forecastSeries[0]
    renderCurrent(currentEntry)

    const highestForecast = Math.max(...forecastSeries.map((f) => findGustValue(f) ?? 0))
    const highestHistory = Math.max(...historySeries.map((f) => findGustValue(f) ?? 0))
    const overallHigh = Math.max(highestForecast, highestHistory)
    const severity = gustSeverity(overallHigh)

    if (severity === 'danger') {
      setStatus('Red alert: forecast or recent gusts exceed 45 mph.', 'danger')
    } else if (severity === 'amber') {
      setStatus('Amber watch: gusts approaching 45 mph.', 'warning')
    } else {
      setStatus('All clear: gusts below 45 mph.', 'success')
    }
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'Something went wrong. Please try again.', 'danger')
    renderForecast([])
    renderHistory([])
    renderCurrent({})
  } finally {
    form.querySelector('button').disabled = false
  }
}

form.addEventListener('submit', handleSearch)
