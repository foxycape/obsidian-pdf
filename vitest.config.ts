import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createFoxycapeCoreAliases } from './scripts/resolveFoxycapeCore'

const packageDir = resolve(__dirname)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      ...createFoxycapeCoreAliases(packageDir),
      { find: /^@\//, replacement: `${resolve(packageDir, 'src').replace(/\\/g, '/')}/` },
      {
        find: 'obsidian',
        replacement: resolve(packageDir, 'scripts/test/mocks/obsidian.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
