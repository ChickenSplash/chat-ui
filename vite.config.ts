import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same paths the production nginx proxies, so the app never needs CORS or a base URL.
// Point these at a running HMS: `php artisan serve` and `php artisan reverb:start` by default.
const hms = process.env.HMS_URL ?? 'http://localhost:8000'
const reverb = process.env.REVERB_URL ?? 'ws://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/': hms,
      '/sanctum/': hms,
      '/app/': { target: reverb, ws: true },
    },
  },
})
