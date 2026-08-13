/// <reference types="vite/client" />

/** Baked at build time from pdf.js version only (remote cmaps / fonts pack). */
declare const __FOXYCAPE_PDFJS_CMAPS_ID__: string

declare module 'virtual:foxycape-embedded-assets' {
  export const EMBEDDED_RUNTIME_ASSETS_BASE64: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
