/** Ambient shims so typecheck works without vendored core paths (npm @foxycape/core). */
export {}

declare global {
  interface Element {
    /** Visible in a specified range, not necessarily visible on the screen */
    isVisible: boolean
    /** Visible in the window */
    isVisibleInWindow: boolean
    /** Fully visible in the window */
    isFullVisibleInWindow: boolean
    /** Element sequence number */
    sequence: number
  }
}

declare module '*.html'
declare module '*.scss'
declare module '*.css' {}
declare module '*.png'
declare module '*.js'
declare module '*.html?raw'
declare module '*.js?raw'
declare module '*.mjs?raw'
declare module '*.js?url'
declare module '*.mjs?url'
declare module '*/?url'
declare module '*.css?raw'
