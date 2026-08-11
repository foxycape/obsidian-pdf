
import { debounce as  asyncDebounce} from 'perfect-debounce'
export {asyncDebounce};

type CallbackFunc<T extends unknown[]> = (...args: T) => void

/** Throttled function plus cancel for a pending trailing call (already-fired leading calls cannot be undone) */
export type ThrottledFunction<T extends unknown[]> = CallbackFunc<T> & {
  cancel: () => void
}

export function debounce<T extends unknown[]>(
  func: CallbackFunc<T>,
  wait: number,
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return (...args: T) => {
    const later = () => {
      clearTimeout(timeoutId)
      func(...args)
    }

    if (timeoutId)
      clearTimeout(timeoutId)
    timeoutId = setTimeout(later, wait)
  }
}

/**
 * @param trailing When true, enables trailing: during cooldown, schedule one more call with the latest args at the end of the interval (combined with leading)
 * @returns Call `throttled.cancel()` to clear a pending trailing timer (recommended on teardown/destroy)
 */
export function throttle<T extends unknown[]>(
  func: CallbackFunc<T>,
  wait: number,
  trailing = false,
): ThrottledFunction<T> {
  if (!trailing) {
    let lastInvokedAt = 0
    const run = (...args: T) => {
      const now = Date.now()
      if (now - lastInvokedAt >= wait) {
        lastInvokedAt = now
        func(...args)
      }
    }
    run.cancel = () => {}
    return run
  }

  let lastInvokedAt = 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: T | undefined

  const cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    pendingArgs = undefined
  }

  const run = (...args: T) => {
    const now = Date.now()
    const elapsed = now - lastInvokedAt
    const remaining = wait - elapsed

    if (remaining <= 0) {
      cancel()
      lastInvokedAt = now
      func(...args)
    } else {
      pendingArgs = args
      if (timeoutId === undefined) {
        timeoutId = setTimeout(() => {
          timeoutId = undefined
          lastInvokedAt = Date.now()
          if (pendingArgs !== undefined) {
            const a = pendingArgs
            pendingArgs = undefined
            func(...a)
          }
        }, remaining)
      }
    }
  }
  run.cancel = cancel
  return run
}

// export function asyncDebounce<
//   F extends (...args: any[]) => Promise<any>
// >(func: F, wait?: number) {
//   const resolveSet = new Set<(p: any) => void>();
//   const rejectSet = new Set<(p: any) => void>();

//   const debounced = debounce((args: Parameters<F>) => {
//     func(...args)
//       .then((...res) => {
//         resolveSet.forEach((resolve) => resolve(...res));
//         resolveSet.clear();
//       })
//       .catch((...res) => {
//         rejectSet.forEach((reject) => reject(...res));
//         rejectSet.clear();
//       });
//   }, wait);

//   return (...args: Parameters<F>): ReturnType<F> => new Promise((resolve, reject) => {
//     resolveSet.add(resolve);
//     rejectSet.add(reject);
//     debounced(args);
//   }) as ReturnType<F>;
// }