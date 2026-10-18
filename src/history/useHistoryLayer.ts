import { onBeforeUnmount, watch, type WatchSource } from 'vue'
import { useMobileHistoryStack, type HistoryTarget } from './useMobileHistoryStack'

export const useHistoryLayer = (isOpen: WatchSource<boolean>, close: () => void) => {
  const holder: HistoryTarget = {}
  const { pushHistoryState, historyBack } = useMobileHistoryStack()

  watch(
    isOpen,
    (open) => {
      if (open) {
        pushHistoryState(holder, close)
        return
      }
      historyBack(holder)
    },
    { flush: 'sync' },
  )

  onBeforeUnmount(() => {
    historyBack(holder)
  })
}
