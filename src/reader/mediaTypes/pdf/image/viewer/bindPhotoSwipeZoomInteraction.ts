import type PhotoSwipe from 'photoswipe'
import { syncPhotoSwipeZoomCursor } from './syncPhotoSwipeZoomCursor'

export const bindPhotoSwipeZoomInteraction = (pswp: PhotoSwipe | null | undefined) => {
  if (!pswp) return

  let attached = false

  const attach = () => {
    if (attached || !pswp.element) return
    attached = true

    const refreshCursor = () => {
      syncPhotoSwipeZoomCursor(pswp)
    }

    const onDoubleClick = (event: MouseEvent) => {
      if (event.button > 0) return

      const target = event.target as HTMLElement | null
      if (!target?.closest('.pswp__container')) return

      const slide = pswp.currSlide
      if (!slide?.isZoomable()) return
      if (Math.abs(slide.zoomLevels.initial - slide.zoomLevels.secondary) < 0.01) return

      event.preventDefault()

      slide.toggleZoom({
        x: event.pageX - pswp.offset.x,
        y: event.pageY - pswp.offset.y,
      })
      refreshCursor()
    }

    pswp.element.addEventListener('dblclick', onDoubleClick)
    pswp.on('zoomPanUpdate', refreshCursor)
    pswp.on('change', refreshCursor)
    pswp.on('loadComplete', refreshCursor)
    pswp.on('openingAnimationEnd', refreshCursor)
    pswp.on('destroy', () => {
      pswp.element?.removeEventListener('dblclick', onDoubleClick)
    })

    refreshCursor()
  }

  if (pswp.element) {
    attach()
  } else {
    pswp.on('firstUpdate', attach)
  }
}
