import tsparser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'vendor/**',
      'coverage/**',
      'scripts/**',
      'vite*.ts',
      '**/*.vue',
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // Sample-template rules are irrelevant for this plugin.
      'obsidianmd/sample-names': 'off',
    },
  },
])
