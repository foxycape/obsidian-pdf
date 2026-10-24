import { nextTick, onBeforeUnmount, type Ref } from 'vue'

const BOTTOM_DEVIATION = 30
const SCROLL_THROTTLE_MS = 100

const isAtBottom = (el: HTMLElement) => {
  const max = el.scrollHeight - el.clientHeight
  return max - Math.abs(el.scrollTop) <= BOTTOM_DEVIATION
}

const applyScroll = async (el: HTMLElement) => {
  await nextTick()
  el.scrollTop = el.scrollHeight - el.clientHeight
}

export const useChatScroller = (scrollerEl: Ref<HTMLElement | null>) => {
  let pinned = false
  let lastScrollTime = 0
  let observer: ResizeObserver | undefined
  let throttleTimer: number | undefined

  const follow = async (type?: 'auto' | 'force') => {
    lastScrollTime = Date.now()
    const el = scrollerEl.value
    if (!el) {
      return
    }
    const mode = type ?? (pinned ? 'force' : 'auto')
    if (mode === 'force') {
      await applyScroll(el)
      return
    }
    if (!isAtBottom(el)) {
      return
    }
    await applyScroll(el)
  }

  const followThrottled = (type?: 'auto' | 'force') => {
    const now = Date.now()
    const wait = SCROLL_THROTTLE_MS - (now - lastScrollTime)
    if (wait > 0) {
      if (!throttleTimer) {
        throttleTimer = window.setTimeout(() => {
          throttleTimer = undefined
          void follow(type)
        }, wait)
      }
      return
    }
    void follow(type)
  }

  const unpin = () => {
    pinned = false
    if (throttleTimer) {
      window.clearTimeout(throttleTimer)
      throttleTimer = undefined
    }
    observer?.disconnect()
    observer = undefined
    const el = scrollerEl.value
    if (!el) {
      return
    }
    el.removeEventListener('wheel', unpin, true)
    el.removeEventListener('touchmove', unpin, true)
    el.removeEventListener('keyup', unpin, true)
  }

  const pin = () => {
    unpin()
    const el = scrollerEl.value
    if (!el) {
      return
    }
    pinned = true
    observer = new ResizeObserver(() => {
      followThrottled('force')
    })
    observer.observe(el)
    el.addEventListener('wheel', unpin, true)
    el.addEventListener('touchmove', unpin, true)
    el.addEventListener('keyup', unpin, true)
  }

  onBeforeUnmount(unpin)

  return { pin, unpin, follow, followThrottled }
}
