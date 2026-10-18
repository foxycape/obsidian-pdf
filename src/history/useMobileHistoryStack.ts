import { getRandomId } from '@foxycape/core/kernal/common/uuid'

export type HistoryTarget = {
  closed?: boolean
}

type HistoryStatePayload = {
  lhxid: string
  previousId?: string
}

type HistoryRecord = HistoryStatePayload & {
  target: HistoryTarget
  close: () => void
}

type HistoryLike = {
  state: unknown
  pushState: (data: unknown, unused: string, url?: string | URL | null) => void
  back: () => void
}

type WindowLike = {
  addEventListener: (type: 'popstate', listener: (event: PopStateEvent) => void) => void
  removeEventListener: (type: 'popstate', listener: (event: PopStateEvent) => void) => void
}

export type MobileHistoryStackOptions = {
  getHistory?: () => HistoryLike
  getWindow?: () => WindowLike
  createId?: () => string
  /** Plugin leaves this empty so an empty stack does not close the PDF. */
  onBackToHome?: () => void
}

const isBrowser = () => typeof window !== 'undefined'

export const createMobileHistoryStack = (options: MobileHistoryStackOptions = {}) => {
  const historyRecords: HistoryRecord[] = []
  const hangObjects: { target: HistoryTarget; close: () => void }[] = []

  let isBacking = false
  let lastBackingRecord: HistoryRecord | null = null
  let listenerRegistered = false

  const resolveHistory = (): HistoryLike | undefined => {
    if (options.getHistory) {
      return options.getHistory()
    }
    if (!isBrowser()) {
      return undefined
    }
    return window.history
  }

  const resolveWindow = (): WindowLike | undefined => {
    if (options.getWindow) {
      return options.getWindow()
    }
    if (!isBrowser()) {
      return undefined
    }
    return window
  }

  const nextId = () => options.createId?.() ?? getRandomId(true)

  const pushRecord = (target: HistoryTarget, close: () => void) => {
    const historyApi = resolveHistory()
    if (!historyApi) {
      return
    }
    const id = nextId()
    const historyState: HistoryStatePayload = {
      lhxid: id,
      previousId: (historyApi.state as HistoryStatePayload | null)?.lhxid,
    }
    const historyRecord: HistoryRecord = {
      ...historyState,
      target,
      close,
    }
    target.closed = false
    historyRecords.push(historyRecord)
    historyApi.pushState(historyState, '', '')
  }

  const pushHangHistoryStates = () => {
    if (hangObjects.length === 0) {
      return
    }
    const pending = hangObjects.splice(0, hangObjects.length)
    for (const obj of pending) {
      pushRecord(obj.target, obj.close)
    }
  }

  const backToHomeIfAllow = () => {
    options.onBackToHome?.()
  }

  const handlePopstate = (event: PopStateEvent) => {
    const currentState = event.state as HistoryStatePayload | null
    const id = currentState?.lhxid

    if (lastBackingRecord) {
      if (id && id === lastBackingRecord.previousId) {
        pushHangHistoryStates()
        isBacking = false
        lastBackingRecord = null
      } else if (!currentState?.lhxid) {
        pushHangHistoryStates()
        isBacking = false
        lastBackingRecord = null
      }
      return
    }

    if (id) {
      const indexId = historyRecords.findIndex((record) => record.previousId === id)
      if (indexId >= 0) {
        const previous = historyRecords[indexId]
        historyRecords.splice(indexId, 1)
        if (previous?.target && previous.close && !previous.target.closed) {
          previous.target.closed = true
          previous.close()
        }
      }
      return
    }

    if (historyRecords.length > 0) {
      const leftover = historyRecords.splice(0, historyRecords.length)
      for (const record of leftover) {
        if (record?.target && record.close && !record.target.closed) {
          record.target.closed = true
          record.close()
        }
      }
      if (historyRecords.length === 0) {
        backToHomeIfAllow()
      }
    } else {
      backToHomeIfAllow()
    }

    pushHangHistoryStates()
    isBacking = false
    lastBackingRecord = null
  }

  const ensurePopstateListener = () => {
    const win = resolveWindow()
    if (!win || listenerRegistered) {
      return
    }
    listenerRegistered = true
    win.addEventListener('popstate', handlePopstate)
  }

  const pushHistoryState = (target: HistoryTarget, close: () => void) => {
    if (!target || !close) {
      return
    }
    if (!resolveHistory()) {
      return
    }
    ensurePopstateListener()
    try {
      if (isBacking) {
        hangObjects.push({ target, close })
        return
      }
      pushRecord(target, close)
    } catch (err) {
      console.error(err)
    }
  }

  const historyBack = (target: HistoryTarget) => {
    if (target.closed) {
      return
    }
    if (historyRecords.length === 0) {
      return
    }
    const matched = historyRecords.find((record) => record.target === target)
    if (!matched) {
      return
    }
    const historyApi = resolveHistory()
    if (!historyApi) {
      return
    }
    isBacking = true
    while (historyRecords.length > 0) {
      const record = historyRecords.pop()
      if (record?.target && record.close && !record.target.closed) {
        record.target.closed = true
        record.close()
      }
      lastBackingRecord = record ?? null
      historyApi.back()
      if (record?.target === target) {
        break
      }
    }
  }

  const dispose = () => {
    const win = resolveWindow()
    if (win && listenerRegistered) {
      win.removeEventListener('popstate', handlePopstate)
    }
    listenerRegistered = false
    historyRecords.splice(0)
    hangObjects.splice(0)
    isBacking = false
    lastBackingRecord = null
  }

  return {
    pushHistoryState,
    historyBack,
    dispose,
  }
}

let defaultStack: ReturnType<typeof createMobileHistoryStack> | undefined

export const useMobileHistoryStack = () => {
  defaultStack ??= createMobileHistoryStack()
  return defaultStack
}

export const pushHistoryState = (
  target: HistoryTarget,
  close: () => void,
) => useMobileHistoryStack().pushHistoryState(target, close)

export const historyBack = (target: HistoryTarget) => useMobileHistoryStack().historyBack(target)

export const resetMobileHistoryStack = () => {
  defaultStack?.dispose()
  defaultStack = undefined
}
