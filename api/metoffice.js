export default async function handler(req, res) {
  const apiKey = process.env.METOFFICE_API_KEY
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`)
  const endpoint = searchParams.get('endpoint') // 'hourly' or 'three-hourly'
  const latitude = searchParams.get('latitude')
  const longitude = searchParams.get('longitude')
  const includeLocationName = searchParams.get('includeLocationName') || 'true'

  if (!endpoint || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  const url = `https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/${endpoint}?latitude=${latitude}&longitude=${longitude}&includeLocationName=${includeLocationName}`

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'accept': 'application/json',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Met Office API returned ${response.status}` 
      })
    }

    const data = await response.json()
    res.setHeader('Cache-Control', 'max-age=300') // Cache for 5 minutes
    return res.status(200).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Failed to fetch from Met Office' })
  }
}
