import { createApp, h, markRaw, shallowReactive, type App } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type {
  PdfViewPreferencePatch,
  PdfViewPreferences,
} from '@/reader/mediaTypes/pdf/CustomPdfOptions'
import PdfViewChromeApp from './PdfViewChromeApp.vue'
import PdfLeftNavPanel from '@/sidebar/PdfLeftNavPanel.vue'
import { isViewHeaderVisible } from './isViewHeaderVisible'

export type PdfChromePlacement = 'header' | 'fallback'

export type PdfChromeMount = {
  placement: PdfChromePlacement
  setSidebarOpen: (open: boolean) => void
  setScreenshotActive: (active: boolean) => void
  openSettings: () => void
  updateReader: (reader: Reader) => void
  dispose: () => void
}

type ChromeState = {
  reader: Reader
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  sidebarOpen: boolean
  settingsOpenNonce: number
  onToggleSidebar: () => void
  onRequestCloseSidebar?: () => void
  onOpenMoreMenu?: (event: MouseEvent) => void
  onToggleScreenshot?: () => void
  screenshotActive: boolean
  getViewPreferences: () => PdfViewPreferences
  onUpdateViewPreferences: (patch: PdfViewPreferencePatch) => Promise<void>
  navTarget: HTMLElement
  pageTarget: HTMLElement
  screenshotTarget: HTMLElement
  zoomTarget: HTMLElement
  settingsTarget: HTMLElement
  moreTarget: HTMLElement | null
}

type ChromeHosts = {
  placement: PdfChromePlacement
  navParent: HTMLElement
  pageParent: HTMLElement
  actionsParent: HTMLElement
  fallbackToolbar: HTMLElement | null
}

const CHROME_DOM_SELECTOR =
  '.foxycape-pdf-header-nav, .foxycape-pdf-header-page, .foxycape-pdf-header-screenshot, .foxycape-pdf-header-zoom, .foxycape-pdf-header-search, .foxycape-pdf-header-settings, .foxycape-pdf-header-more, .foxycape-pdf-chrome-root, .foxycape-pdf-fallback-toolbar'

const removeChromeDom = (...roots: Array<HTMLElement | null | undefined>) => {
  for (const root of roots) {
    root
      ?.querySelectorAll(CHROME_DOM_SELECTOR)
      .forEach((el) => el.remove())
  }
}

const resolveChromeHosts = (
  containerEl: HTMLElement,
  contentEl: HTMLElement,
): ChromeHosts => {
  if (isViewHeaderVisible(containerEl)) {
    const header = containerEl.querySelector<HTMLElement>('.view-header')
    const left = header?.querySelector<HTMLElement>('.view-header-left')
    const titleContainer = header?.querySelector<HTMLElement>(
      '.view-header-title-container',
    )
    const actions = header?.querySelector<HTMLElement>('.view-actions')
    if (left && titleContainer && actions) {
      return {
        placement: 'header',
        navParent: left,
        pageParent: titleContainer,
        actionsParent: actions,
        fallbackToolbar: null,
      }
    }
  }

  const fallbackToolbar = contentEl.createDiv({
    cls: 'foxycape-pdf-fallback-toolbar',
  })
  contentEl.insertBefore(fallbackToolbar, contentEl.firstChild)
  return {
    placement: 'fallback',
    navParent: fallbackToolbar.createDiv({
      cls: 'foxycape-pdf-fallback-toolbar__left',
    }),
    pageParent: fallbackToolbar.createDiv({
      cls: 'foxycape-pdf-fallback-toolbar__center',
    }),
    actionsParent: fallbackToolbar.createDiv({
      cls: 'foxycape-pdf-fallback-toolbar__right',
    }),
    fallbackToolbar,
  }
}

export const mountPdfViewChrome = (options: {
  containerEl: HTMLElement
  contentEl: HTMLElement
  sidebarHost: HTMLElement
  reader: Reader
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onRequestCloseSidebar?: () => void
  onOpenMoreMenu?: (event: MouseEvent) => void
  onToggleScreenshot?: () => void
  screenshotActive?: boolean
  getViewPreferences: () => PdfViewPreferences
  onUpdateViewPreferences: (patch: PdfViewPreferencePatch) => Promise<void>
}): PdfChromeMount => {
  removeChromeDom(options.containerEl, options.contentEl)

  const hosts = resolveChromeHosts(options.containerEl, options.contentEl)

  options.containerEl.toggleClass(
    'foxycape-pdf-chrome-fallback',
    hosts.placement === 'fallback',
  )

  const navTarget = hosts.navParent.createDiv({ cls: 'foxycape-pdf-header-nav' })
  const pageTarget = hosts.pageParent.createDiv({
    cls: 'foxycape-pdf-header-page',
  })
  const screenshotTarget = createDiv({ cls: 'foxycape-pdf-header-screenshot' })
  hosts.actionsParent.insertBefore(screenshotTarget, hosts.actionsParent.firstChild)
  const zoomTarget = createDiv({ cls: 'foxycape-pdf-header-zoom' })
  screenshotTarget.after(zoomTarget)
  const settingsTarget = createDiv({ cls: 'foxycape-pdf-header-settings' })
  zoomTarget.after(settingsTarget)
  // Native Obsidian more-options lives in the tab title bar; recreate it in fallback.
  let moreTarget: HTMLElement | null = null
  if (hosts.placement === 'fallback' && options.onOpenMoreMenu) {
    moreTarget = createDiv({ cls: 'foxycape-pdf-header-more' })
    settingsTarget.after(moreTarget)
  }

  const teleportRoot = options.containerEl.createDiv({
    cls: 'foxycape-pdf-chrome-root',
  })
  teleportRoot.hidden = true

  // Reader / DOM hosts must not be Vue-proxied: pdf.js private methods break on Proxy.
  const state = shallowReactive<ChromeState>({
    reader: markRaw(options.reader),
    t: options.t,
    sidebarOpen: options.sidebarOpen,
    settingsOpenNonce: 0,
    onToggleSidebar: options.onToggleSidebar,
    onRequestCloseSidebar: options.onRequestCloseSidebar,
    onOpenMoreMenu: options.onOpenMoreMenu,
    onToggleScreenshot: options.onToggleScreenshot,
    screenshotActive: options.screenshotActive ?? false,
    getViewPreferences: options.getViewPreferences,
    onUpdateViewPreferences: options.onUpdateViewPreferences,
    navTarget: markRaw(navTarget),
    pageTarget: markRaw(pageTarget),
    screenshotTarget: markRaw(screenshotTarget),
    zoomTarget: markRaw(zoomTarget),
    settingsTarget: markRaw(settingsTarget),
    moreTarget: moreTarget ? markRaw(moreTarget) : null,
  })

  const chromeApp: App = createApp({
    setup: () => () =>
      h(PdfViewChromeApp, {
        // reactive() unwraps class types; markRaw+toRaw keep the runtime instance.
        reader: state.reader,
        t: state.t,
        sidebarOpen: state.sidebarOpen,
        settingsOpenNonce: state.settingsOpenNonce,
        screenshotActive: state.screenshotActive,
        onToggleSidebar: state.onToggleSidebar,
        onOpenMoreMenu: state.onOpenMoreMenu,
        onToggleScreenshot: state.onToggleScreenshot,
        getViewPreferences: state.getViewPreferences,
        onUpdateViewPreferences: state.onUpdateViewPreferences,
        navTarget: state.navTarget,
        pageTarget: state.pageTarget,
        screenshotTarget: state.screenshotTarget,
        zoomTarget: state.zoomTarget,
        settingsTarget: state.settingsTarget,
        moreTarget: state.moreTarget,
      }),
  })
  chromeApp.mount(teleportRoot)

  const sidebarApp: App = createApp({
    setup: () => () =>
      h(PdfLeftNavPanel, {
        reader: state.reader,
        t: state.t,
        open: state.sidebarOpen,
        onRequestClose: state.onRequestCloseSidebar,
      }),
  })
  sidebarApp.mount(options.sidebarHost)

  return {
    placement: hosts.placement,
    setSidebarOpen: (open: boolean) => {
      state.sidebarOpen = open
    },
    setScreenshotActive: (active: boolean) => {
      state.screenshotActive = active
    },
    openSettings: () => {
      state.settingsOpenNonce += 1
    },
    updateReader: (reader: Reader) => {
      state.reader = markRaw(reader)
    },
    dispose: () => {
      chromeApp.unmount()
      sidebarApp.unmount()
      teleportRoot.remove()
      navTarget.remove()
      pageTarget.remove()
      screenshotTarget.remove()
      zoomTarget.remove()
      settingsTarget.remove()
      moreTarget?.remove()
      hosts.fallbackToolbar?.remove()
      options.containerEl.removeClass('foxycape-pdf-chrome-fallback')
    },
  }
}
