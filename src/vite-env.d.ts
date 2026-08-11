/// <reference types="vite/client" />
/// <reference path="../vendor/core/global.d.ts" />
/// <reference path="../vendor/core/types.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
