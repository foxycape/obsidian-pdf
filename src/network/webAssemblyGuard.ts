/**
 * signer.js installs a wasm2js stand-in that has instantiate but no compile.
 * hash-wasm calls WebAssembly.compile while opening a file. The object captured
 * here is the runtime from module evaluation, before that script runs.
 */
type WebAssemblyRuntime = typeof WebAssembly

const isNativeFunction = (value: unknown): boolean =>
  typeof value === 'function' && Function.prototype.toString.call(value).includes('[native code]')

/** signer.js Module is a plain function. The runtime Module is native code. */
const isSignerStub = (wasm: unknown): boolean => {
  if (wasm === null || typeof wasm !== 'object') {
    return false
  }
  const moduleCtor = (wasm as { Module?: unknown }).Module
  return typeof moduleCtor === 'function' && !isNativeFunction(moduleCtor)
}

const isRuntime = (wasm: unknown): wasm is WebAssemblyRuntime => {
  if (wasm === null || typeof wasm !== 'object' || isSignerStub(wasm)) {
    return false
  }
  return typeof (wasm as WebAssemblyRuntime).Module === 'function'
}

const installCompile = (wasm: WebAssemblyRuntime): void => {
  if (typeof wasm.compile === 'function') {
    return
  }
  const ModuleCtor = wasm.Module
  const compile = (bytes: BufferSource) => Promise.resolve().then(() => new ModuleCtor(bytes))
  try {
    Object.defineProperty(wasm, 'compile', {
      configurable: true,
      writable: true,
      value: compile,
    })
  } catch {
    wasm.compile = compile as WebAssemblyRuntime['compile']
  }
}

const readGlobal = (): unknown =>
  typeof globalThis.WebAssembly === 'undefined' ? undefined : globalThis.WebAssembly

let runtimeWebAssembly: WebAssemblyRuntime | undefined = isRuntime(readGlobal())
  ? (readGlobal() as WebAssemblyRuntime)
  : undefined

if (runtimeWebAssembly) {
  installCompile(runtimeWebAssembly)
}

let wasmFrame: HTMLIFrameElement | undefined

const webAssemblyFromFrame = (): WebAssemblyRuntime | undefined => {
  if (typeof document === 'undefined') {
    return undefined
  }
  const parent = document.body ?? document.documentElement
  if (!parent) {
    return undefined
  }
  if (!wasmFrame) {
    wasmFrame = document.createElement('iframe')
    wasmFrame.hidden = true
    wasmFrame.setAttribute('aria-hidden', 'true')
    parent.appendChild(wasmFrame)
  }
  const framed = wasmFrame.contentWindow?.WebAssembly
  return isRuntime(framed) ? framed : undefined
}

const assignWebAssembly = (wasm: WebAssemblyRuntime): void => {
  ;(globalThis as { WebAssembly: WebAssemblyRuntime }).WebAssembly = wasm
  if (typeof window !== 'undefined' && window.WebAssembly !== wasm) {
    ;(window as unknown as { WebAssembly: WebAssemblyRuntime }).WebAssembly = wasm
  }
}

/** Put back a WebAssembly object that hash-wasm can compile with. */
export const restoreWebAssemblyForHash = (preferred?: WebAssemblyRuntime): void => {
  const candidate = isRuntime(preferred) ? preferred : runtimeWebAssembly
  if (isRuntime(candidate)) {
    installCompile(candidate)
  }
  if (!candidate || typeof candidate.compile !== 'function') {
    const framed = webAssemblyFromFrame()
    if (framed) {
      installCompile(framed)
      if (typeof framed.compile === 'function') {
        runtimeWebAssembly = framed
        assignWebAssembly(framed)
        return
      }
    }
  }
  const native =
    isRuntime(candidate) && typeof candidate.compile === 'function' ? candidate : runtimeWebAssembly
  if (!native || typeof native.compile !== 'function') {
    return
  }
  runtimeWebAssembly = native
  const current = readGlobal()
  if (current === native && isRuntime(current) && typeof current.compile === 'function') {
    return
  }
  assignWebAssembly(native)
}
