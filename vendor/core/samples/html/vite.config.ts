import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@': resolve(__dirname, '../..'),
    },
  },
  server: {
    // Windows: Vite may bind only to ::1; browsers/tools hitting 127.0.0.1 then fail.
    host: '127.0.0.1',
    port: 5178,
    open: true,
  },
})
