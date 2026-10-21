import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// Tailwind CSS v4 is wired through the Vite plugin only.
// There is deliberately no tailwind.config.js / postcss.config.js — that is the v3 flow.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
