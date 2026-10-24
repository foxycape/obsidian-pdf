import { toRaw, unref } from 'vue'

const isPlainObject = (value: object) => {
  const proto = Reflect.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const isBinary = (value: object) =>
  value instanceof ArrayBuffer || value instanceof Blob || ArrayBuffer.isView(value)

/**
 * Strip Vue proxies so IndexedDB can structured-clone the value.
 * Keeps ArrayBuffer / Date / Map / Set intact; only rebuilds plain objects and arrays.
 */
export const toStorageValue = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  const unwrapped = unref(value)
  if (unwrapped === null || unwrapped === undefined || typeof unwrapped !== 'object') {
    return unwrapped
  }
  const raw = toRaw(unwrapped)
  if (seen.has(raw)) {
    return seen.get(raw) as T
  }
  if (raw instanceof Date || raw instanceof Map || raw instanceof Set || isBinary(raw)) {
    return raw
  }
  if (Array.isArray(raw)) {
    const clone: unknown[] = []
    seen.set(raw, clone)
    for (const item of raw) {
      clone.push(toStorageValue(item, seen))
    }
    return clone as T
  }
  if (!isPlainObject(raw)) {
    return raw
  }
  const clone: Record<string, unknown> = {}
  seen.set(raw, clone)
  for (const key of Object.keys(raw)) {
    clone[key] = toStorageValue((raw as Record<string, unknown>)[key], seen)
  }
  return clone as T
}
