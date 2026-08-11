// scheduler-polyfill expects a browser-like global `self`.
;(globalThis as typeof globalThis & { self: typeof globalThis }).self = globalThis
