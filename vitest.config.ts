import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const packageDir = resolve(__dirname)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(packageDir, 'src'),
      '@core': resolve(packageDir, 'vendor/core'),
      obsidian: resolve(packageDir, 'scripts/test/mocks/obsidian.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
