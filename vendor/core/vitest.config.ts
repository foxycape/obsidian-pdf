import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  },
  test: {
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: false
  }
})
