import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      proxy: {
        '/metoffice': {
          target: 'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/metoffice/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('accept', 'application/json')
              proxyReq.setHeader('apikey', env.VITE_METOFFICE_API_KEY)
            })
          },
        },
      },
    },
  }
})
