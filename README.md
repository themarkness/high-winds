## Wind Gust Monitor (Met Office DataHub)

Client-only web app for checking current, forecast, and recent wind gusts for any UK postcode using the Met Office Weather DataHub (Global Spot Data).

### Features
- Postcode lookup via postcodes.io → coordinates → Met Office DataHub calls
- Current, forecast (5-day window), and last 48h observations
- Automatic alerts: red (≥45mph), amber (35–44mph), green (<35mph)
- Mobile-friendly UI ready for GitHub Pages, Vercel, or Netlify

### Prerequisites
- Node 18+ (for Vite build/dev)
- Met Office Weather DataHub API key (free tier: 360 calls/day) from https://datahub.metoffice.gov.uk/ (subscribe to “Global Spot Data”)

### Quick start
```bash
npm install
cp .env.example .env.local
# edit .env.local and add your key
npm run dev
```

### Building / Deploying
- `npm run build` produces static assets in `dist/` for GitHub Pages, Vercel, or Netlify.
- GitHub Pages: serve `dist/` (configure repo pages to use the `dist` output or publish via an action).
- Vercel/Netlify: set environment variable `VITE_METOFFICE_API_KEY` in project settings; build command `npm run build`; output dir `dist`.
- The API key is injected at build time (front-end apps cannot fully hide keys—rotate if exposed).

### API notes
- Base: `https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point`
- Forecast: `/forecast?latitude={lat}&longitude={lon}&includeLocationName=true`
- Observations: `/observations?latitude={lat}&longitude={lon}&startTime={ISO}&endTime={ISO}`
- Headers: `Accept: application/json`, `X-API-Key: <your key>`
- Gust field: the app searches for any property containing “gust” in each time series item (covers `windGust`, `windGustSpeed`, etc.).

### UI behaviour
- Red alert if any forecasted or recent gust ≥45 mph; amber when 35–44 mph.
- Forecast limited to ~5 days ahead; observations pulled for last 48h when available.
- Clear messaging for invalid postcodes, missing API key, rate limits (429), or empty datasets.

### Tech stack
- Vite + vanilla JS
- postcodes.io for free UK geocoding
- No backend required; all client-side fetch

### Project structure
- `src/main.js` — UI + data fetching/rendering
- `src/style.css` — layout and alert styling
- `.env.example` — API key template

### Notes on limits
- Free Met Office tier allows 360 calls/day. The app performs 2 calls per lookup (forecast + observations).
- If you hit 429, wait or reduce usage; consider caching or spacing lookups in production.

### Testing checklist
- Valid postcode returns location, forecast, and observations.
- Invalid postcode shows a clear error.
- Remove/alter API key to confirm unauthorised and rate-limit messaging.
- Gust thresholds show green/amber/red colouring in current, forecast, and history lists.
