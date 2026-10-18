import { onBeforeUnmount, onMounted } from 'vue'

export const useDismissOnOutside = (
  isOpen: () => boolean,
  getRoots: () => Array<HTMLElement | Element | null | undefined>,
  close: () => void,
) => {
  const onPointerDown = (event: PointerEvent) => {
    if (!isOpen()) {
      return
    }
    const target = event.target
    if (!(target instanceof Node)) {
      close()
      return
    }
    const inside = getRoots().some((root) => root?.contains(target))
    if (!inside) {
      close()
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true)
  })
}
