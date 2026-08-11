import type PhotoSwipe from 'photoswipe'

export const syncPhotoSwipeZoomCursor = (pswp: PhotoSwipe | null | undefined) => {
  const slide = pswp?.currSlide
  const template = pswp?.element
  if (!pswp || !slide || !template) return

  template.classList.remove('pswp--zoom-allowed', 'pswp--click-to-zoom')

  if (
    Math.abs(slide.zoomLevels.initial - slide.zoomLevels.secondary) < 0.01 ||
    !slide.isZoomable()
  ) {
    template.classList.remove('pswp--zoomed-in')
    return
  }

  const atInitial = Math.abs(slide.currZoomLevel - slide.zoomLevels.initial) < 0.01
  template.classList.toggle('pswp--zoomed-in', !atInitial)
}
