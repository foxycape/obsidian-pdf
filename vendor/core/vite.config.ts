import path, { resolve } from 'path'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'fs'
import { defineConfig, type Plugin } from 'vite'
import dts from 'vite-plugin-dts'
import { glob } from 'glob';
import commonjs from '@rollup/plugin-commonjs'
import requireTransform from 'vite-plugin-require-transform';//引入require

emptyDir(resolve(__dirname, 'dist'))
emptyDir(resolve(__dirname, 'types'))

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const dependencyNames = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

const pdfjsRoot = resolve(__dirname, 'pdfjs').replace(/\\/g, '/')

const isPdfjsId = (id: string) => {
  const normalized = id.replace(/\\/g, '/')
  return (
    normalized.includes('/pdfjs/') ||
    normalized.startsWith('pdfjs/') ||
    normalized === 'pdfjs' ||
    normalized.startsWith(pdfjsRoot)
  )
}

const isExternal = (id: string) =>
  dependencyNames.some((name) => id === name || id.startsWith(`${name}/`)) ||
  isPdfjsId(id)

/** Keep vendored pdfjs next to compiled modules so relative imports resolve from dist/. */
const copyPdfjsToDistPlugin = (): Plugin => ({
  name: 'copy-pdfjs-to-dist',
  closeBundle() {
    const from = resolve(__dirname, 'pdfjs')
    const to = resolve(__dirname, 'dist/pdfjs')
    if (!existsSync(from)) {
      return
    }
    rmSync(to, { recursive: true, force: true })
    cpSync(from, to, { recursive: true })
  },
})

// const input = await glob(['./kernal/**/*.{ts,js}', './mediaTypes/**/*.{ts,js}'], {
const input = await glob(['./kernal/**/*.ts', './mediaTypes/**/*.ts'], {
  cwd: __dirname,
  absolute: true
})
// console.log(input)
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  },
  build: {
    commonjsOptions: { include: [] },

    // sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, './kernal/index.ts'),
      name: 'FoxycapeCore',
      // formats: ['es'],
      // fileName: "[name]"
    },
    rollupOptions: {
      input: input,
      // Keep runtime deps external so published consumers resolve them from node_modules.
      external: isExternal,
      output: [
        {
          format: 'cjs',
          preserveModules: true,
          preserveModulesRoot: __dirname,
          dir: 'dist',
          entryFileNames: '[name].cjs'
        },
        {
          format: 'es',
          preserveModules: true,
          preserveModulesRoot: __dirname,
          dir: 'dist',
          entryFileNames: '[name].mjs'
        }
      ],
    }
  },
  worker: {
    format: 'es',
  },
  plugins: [
    commonjs() as any,
    requireTransform({
      fileRegex: /.js$|.ts$/
    }),
    dts({
      entryRoot: path.resolve(__dirname, '.'),
      outDirs: ['dist'],
      include: ['kernal/**/*.ts', 'mediaTypes/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'samples/**', 'tests/**'],
      staticImport: true,
    }),
    copyPdfjsToDistPlugin(),
  ]
})

function emptyDir(dir: string) {
  if (!existsSync(dir)) {
    return
  }

  for (const file of readdirSync(dir)) {
    rmSync(resolve(dir, file), { recursive: true, force: true })
  }
}
