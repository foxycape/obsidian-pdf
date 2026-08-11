import type { ActionType, PhotoSwipeOptions } from 'photoswipe'
import { BrowserCapabilities } from '@core/kernal'

/** Double-tap target: 100% natural size. */
export const getPhotoSwipeSecondaryZoomLevel = () => 1

/** Tap: close on touch devices, no-op on desktop. */
export const getPhotoSwipeTapAction = (): ActionType | false =>
  BrowserCapabilities.isSupportTouch() ? 'close' : false

export const createPhotoSwipeZoomInteractionOptions = (): Pick<
  PhotoSwipeOptions,
  'initialZoomLevel' | 'secondaryZoomLevel' | 'doubleTapAction' | 'tapAction' | 'imageClickAction'
> => ({
  initialZoomLevel: 'fit',
  secondaryZoomLevel: getPhotoSwipeSecondaryZoomLevel,
  doubleTapAction: 'zoom',
  tapAction: getPhotoSwipeTapAction(),
  imageClickAction: false,
})
