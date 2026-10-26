import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The same security headers as vercel.json, so `npm run preview` behaves like production.
const securityHeaders = JSON.parse(readFileSync(new URL('./security-headers.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [react()],
  preview: { headers: securityHeaders },
  test: { environment: 'node' },
})
