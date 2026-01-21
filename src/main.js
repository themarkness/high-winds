import './style.css'

const API_KEY = import.meta.env.VITE_METOFFICE_API_KEY
const METOFFICE_BASE = '/api/metoffice'
const POSTCODE_API = 'https://api.postcodes.io/postcodes/'
const ALERT_THRESHOLD = 45 // mph
const AMBER_THRESHOLD = 35 // mph

const PROPERTIES = [
  { name: 'Saltram House', postcode: 'PL7 1UH', forecastLocation: 'Cornwood' },
  { name: 'Cotehele', postcode: 'PL12 6TA', forecastLocation: 'Liskeard' },
]

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="page">
    <header class="hero">
      <div>
        <h1>National Trust Wind Gust Monitor</h1>
        <p class="lede">
          Check Met Office current, forecast, and recent gusts for any property. Alerts highlight gusts above 45&nbsp;mph. Designed to help teams monitor safety.
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
      <p id="location-info" class="muted" style="margin-top: 1rem;">Select a property to see monitoring location</p>
    </header>

    <section id="status" class="status info">Select a property to begin.</section>

    <section class="grid-3">
      <article class="card">
        <header class="card-header">
          <div>
            <p class="label"><i class="ri-history-line"></i> Historic</p>
            <p class="small-text">Last 48 hours</p>
          </div>
        </header>
        <div id="historic-summary">
          <p class="muted">No data</p>
        </div>
      </article>

      <article class="card">
        <header class="card-header">
          <div>
            <p class="label"><i class="ri-focus-2-line"></i> Current</p>
            <p class="small-text">Right now & today</p>
          </div>
        </header>
        <div id="current-summary">
          <div style="margin-bottom: 1.5rem;">
            <p style="margin: 0 0 0.25rem; font-size: 0.9rem; color: #64748b;"><strong>Next hour</strong></p>
            <h3 id="current-gust" style="margin: 0 0 0.25rem;">--</h3>
            <p id="current-speed" class="wind-speed" style="margin: 0;">Speed: --</p>
            <p id="current-time" class="muted" style="margin: 0.25rem 0 0;">No data yet</p>
          </div>
          <hr style="margin: 1rem 0; border: none; border-top: 1px solid #e2e8f0;">
          <div>
            <p style="margin: 0 0 0.25rem; font-size: 0.9rem; color: #64748b;"><strong>Daily summary</strong></p>
            <h3 id="max-gust-today" style="margin: 0 0 0.25rem;">--</h3>
            <p id="wind-direction-today" class="muted" style="margin: 0;">Direction: --</p>
            <p id="daily-summary" class="muted" style="margin: 0.25rem 0 0;">No data yet</p>
          </div>
        </div>
      </article>

      <article class="card">
        <header class="card-header">
          <div>
            <p class="label"><i class="ri-cloud-line"></i> Forecast</p>
            <p class="small-text">Next 48 hours</p>
          </div>
        </header>
        <div id="forecast-summary">
          <p class="muted">No data</p>
        </div>
      </article>
    </section>

    <section class="card">
      <header class="card-header">
        <div>
          <p class="label"><i class="ri-line-chart-line"></i> Wind data over time</p>
          <h2>Wind Speed & Gusts</h2>
        </div>
      </header>
      <div id="chart-container" class="chart-container">
        <canvas id="wind-chart"></canvas>
      </div>
    </section>
  </main>
`

const form = document.querySelector('#postcode-form')
const statusEl = document.querySelector('#status')
const windChartCanvas = document.querySelector('#wind-chart')
const historicSummaryEl = document.querySelector('#historic-summary')
const currentSummaryEl = document.querySelector('#current-summary')
const forecastSummaryEl = document.querySelector('#forecast-summary')
const currentGustEl = document.querySelector('#current-gust')
const currentSpeedEl = document.querySelector('#current-speed')
const currentTimeEl = document.querySelector('#current-time')
const locationInfoEl = document.querySelector('#location-info')
const maxGustTodayEl = document.querySelector('#max-gust-today')
const windDirectionTodayEl = document.querySelector('#wind-direction-today')
const dailySummaryEl = document.querySelector('#daily-summary')

let windChart = null

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

function msToMph(ms) {
  // Convert meters per second to miles per hour: m/s * 2.237
  return ms * 2.237
}

function degreeToCompass(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round((degrees ?? 0) / 22.5) % 16
  return directions[index]
}

function formatWindDirection(degrees) {
  const compass = degreeToCompass(degrees)
  return `${compass} (${degrees}°)`
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
  // Check for specific field names in order of preference
  if (entry.windGustSpeed10m !== undefined) return msToMph(Number(entry.windGustSpeed10m))
  if (entry.max10mWindGust !== undefined) return msToMph(Number(entry.max10mWindGust))
  if (entry.windGust !== undefined) return msToMph(Number(entry.windGust))
  if (entry.gustSpeed !== undefined) return msToMph(Number(entry.gustSpeed))
  // Fallback to generic search
  const key = Object.keys(entry).find((k) => k.toLowerCase().includes('gust'))
  return key ? msToMph(Number(entry[key])) : null
}

function findSpeedValue(entry) {
  if (!entry || typeof entry !== 'object') return null
  // Check for specific field names in order of preference
  if (entry.windSpeed10m !== undefined) return msToMph(Number(entry.windSpeed10m))
  if (entry.windSpeed !== undefined) return msToMph(Number(entry.windSpeed))
  if (entry.speed !== undefined && !Object.keys(entry).some(k => k.toLowerCase().includes('gust') && entry[k] === entry.speed)) {
    return msToMph(Number(entry.speed))
  }
  // Fallback to generic search
  const key = Object.keys(entry).find((k) => {
    const lower = k.toLowerCase()
    return lower.includes('wind') && lower.includes('speed') && !lower.includes('gust')
  })
  return key ? msToMph(Number(entry[key])) : null
}

function renderCurrent(entry) {
  const gust = findGustValue(entry)
  const speed = findSpeedValue(entry)
  currentGustEl.textContent = gustLabel(gust)
  currentSpeedEl.textContent = speed !== null && speed !== undefined ? `Speed: ${speed.toFixed(0)} mph` : 'Speed: --'
  currentTimeEl.textContent = entry?.time ? `Valid at ${formatDate(entry.time)}` : 'Time not provided'
}

function renderHistoricSummary(series) {
  if (!series.length) {
    historicSummaryEl.innerHTML = '<p class="muted">No data</p>'
    return
  }

  const maxGustEntry = series.reduce((max, current) => {
    const currentGust = findGustValue(current)
    const maxGust = findGustValue(max)
    return (currentGust ?? 0) > (maxGust ?? 0) ? current : max
  })

  const maxGust = findGustValue(maxGustEntry)
  const avgSpeed = series.reduce((sum, d) => sum + (findSpeedValue(d) ?? 0), 0) / series.length

  historicSummaryEl.innerHTML = `
    <p style="margin: 0 0 0.5rem;"><strong>Max gust</strong></p>
    <h3 style="margin: 0 0 0.25rem;">${gustLabel(maxGust)}</h3>
    <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Avg speed: ${avgSpeed.toFixed(0)} mph</p>
  `
}

function renderForecastSummary(series) {
  if (!series.length) {
    forecastSummaryEl.innerHTML = '<p class="muted">No data</p>'
    return
  }

  const maxGustEntry = series.reduce((max, current) => {
    const currentGust = findGustValue(current)
    const maxGust = findGustValue(max)
    return (currentGust ?? 0) > (maxGust ?? 0) ? current : max
  })

  const maxGust = findGustValue(maxGustEntry)
  const avgSpeed = series.reduce((sum, d) => sum + (findSpeedValue(d) ?? 0), 0) / series.length

  forecastSummaryEl.innerHTML = `
    <p style="margin: 0 0 0.5rem;"><strong>Max gust</strong></p>
    <h3 style="margin: 0 0 0.25rem;">${gustLabel(maxGust)}</h3>
    <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Avg speed: ${avgSpeed.toFixed(0)} mph</p>
  `
}

function renderDailySummary(series) {
  if (!series.length) {
    maxGustTodayEl.textContent = '--'
    windDirectionTodayEl.textContent = 'Direction: --'
    dailySummaryEl.textContent = 'No data available'
    return
  }

  // Find max gust for today
  const maxGustEntry = series.reduce((max, current) => {
    const currentGust = findGustValue(current)
    const maxGust = findGustValue(max)
    return (currentGust ?? 0) > (maxGust ?? 0) ? current : max
  })

  const maxGust = findGustValue(maxGustEntry)
  const windDir = maxGustEntry?.windDirectionFrom10m
  
  maxGustTodayEl.textContent = gustLabel(maxGust)
  windDirectionTodayEl.textContent = `Direction: ${formatWindDirection(windDir)}`
  
  const compassDir = degreeToCompass(windDir)
  dailySummaryEl.textContent = `Max gust ${gustLabel(maxGust)} from the ${compassDir}`
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
    forecastList.textContent = 'No warnings of high wind in the next 48 hours.'
    return
  }
  
  forecastList.classList.remove('empty')
  forecastList.innerHTML = warnings
    .map((item) => {
      const gust = findGustValue(item)
      const speed = findSpeedValue(item)
      const speedText = speed !== null && speed !== undefined ? `Speed: ${speed.toFixed(0)} mph` : 'Speed: --'
      return `
        <div class="timeline-row danger">
          <div>
            <p class="muted">${formatDate(item.time)}</p>
            <strong>${gustLabel(gust)}</strong>
            <p class="wind-speed">${speedText}</p>
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
      const speed = findSpeedValue(item)
      const speedText = speed !== null && speed !== undefined ? `Speed: ${speed.toFixed(0)} mph` : 'Speed: --'
      return `
        <div class="timeline-row danger">
          <div>
            <p class="muted">${formatDate(item.time)}</p>
            <strong>${gustLabel(gust)}</strong>
            <p class="wind-speed">${speedText}</p>
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
  const url = `${METOFFICE_BASE}?endpoint=three-hourly&latitude=${latitude}&longitude=${longitude}&includeLocationName=true`
  const headers = {
    accept: 'application/json',
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
  const url = `${METOFFICE_BASE}?endpoint=hourly&latitude=${latitude}&longitude=${longitude}&includeLocationName=true`
  const headers = {
    accept: 'application/json',
  }
  const res = await fetch(url, { headers })
  if (res.status === 401) throw new Error('Unauthorised: check your Met Office API key.')
  if (res.status === 429) throw new Error('Rate limit reached (360 calls/day on free tier). Try later.')
  if (!res.ok) throw new Error('Failed to fetch observation data.')
  return res.json()
}

function filterForecastWindow(series) {
  const now = Date.now()
  const limit = now + 48 * 60 * 60 * 1000
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

function renderWindChart(historySeries, forecastSeries) {
  // Combine all data and filter to 48 hours past and future
  const now = Date.now()
  const pastLimit = now - 48 * 60 * 60 * 1000
  const futureLimit = now + 48 * 60 * 60 * 1000
  
  const allData = [...(historySeries || []), ...(forecastSeries || [])]
    .filter(d => {
      const ts = new Date(d.time).getTime()
      return ts >= pastLimit && ts <= futureLimit
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time))
  
  if (!allData.length) return
  
  const labels = allData.map(d => formatDate(d.time))
  const speedData = allData.map(d => findSpeedValue(d))
  const gustData = allData.map(d => findGustValue(d))
  
  if (windChart) {
    windChart.destroy()
  }
  
  const ctx = windChartCanvas.getContext('2d')
  windChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Wind Speed (mph)',
          data: speedData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: 'Gusts (mph)',
          data: gustData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Wind Speed (mph)',
          },
        },
      },
    },
  })
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
    
    const property = PROPERTIES.find(p => p.postcode === postcode)

    const [forecastData, obsData] = await Promise.all([
      fetchForecast(geo.latitude, geo.longitude),
      fetchObservations(geo.latitude, geo.longitude),
    ])
    
    console.log('Forecast data sample:', forecastData.features?.[0]?.properties?.timeSeries?.[0])
    console.log('Observation data sample:', obsData.features?.[0]?.properties?.timeSeries?.[0])

    const location = property?.forecastLocation || extractLocationName(forecastData, geo.label)
    locationInfoEl.textContent = `${location}. Nearest monitoring location to ${property?.name} ${property?.postcode}`
    
    console.log('Location from API:', location)
    console.log('Forecast location details:', forecastData.features?.[0]?.properties?.location)

    const forecastSeries = filterForecastWindow(extractTimeSeries(forecastData))
    const historySeries = extractTimeSeries(obsData)

    renderWindChart(historySeries, forecastSeries)
    
    // Render 3 summary boxes at top
    renderHistoricSummary(historySeries)
    renderForecastSummary(forecastSeries)

    const currentEntry =
      forecastSeries.length > 0 ? nearestToNow(forecastSeries) : historySeries.at(-1) || forecastSeries[0]
    renderCurrent(currentEntry)
    renderDailySummary(forecastSeries.length > 0 ? forecastSeries : historySeries)

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
    renderCurrent({})
  } finally {
    form.querySelector('button').disabled = false
  }
}

form.addEventListener('submit', handleSearch)
