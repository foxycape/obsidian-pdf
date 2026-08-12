/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.svg?raw' {
  const content: string
  export default content
}

declare module 'virtual:pdfjs-cmaps' {
  const value: Record<string, string>
  export default value
}

declare module 'virtual:pdfjs-standard-fonts' {
  const value: Record<string, string>
  export default value
}
