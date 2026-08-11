import { createApp, h, markRaw, reactive, type App } from 'vue'
import type { Reader } from '@core/kernal'
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
  getViewPreferences: () => PdfViewPreferences
  onUpdateViewPreferences: (patch: PdfViewPreferencePatch) => Promise<void>
  navTarget: HTMLElement
  pageTarget: HTMLElement
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
  '.foxycape-pdf-header-nav, .foxycape-pdf-header-page, .foxycape-pdf-header-zoom, .foxycape-pdf-header-search, .foxycape-pdf-header-settings, .foxycape-pdf-header-more, .foxycape-pdf-chrome-root, .foxycape-pdf-fallback-toolbar'

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
    const header = containerEl.querySelector('.view-header') as HTMLElement | null
    const left = header?.querySelector('.view-header-left') as HTMLElement | null
    const titleContainer = header?.querySelector(
      '.view-header-title-container',
    ) as HTMLElement | null
    const actions = header?.querySelector('.view-actions') as HTMLElement | null
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
  const zoomTarget = document.createElement('div')
  zoomTarget.className = 'foxycape-pdf-header-zoom'
  hosts.actionsParent.insertBefore(zoomTarget, hosts.actionsParent.firstChild)
  const settingsTarget = document.createElement('div')
  settingsTarget.className = 'foxycape-pdf-header-settings'
  zoomTarget.after(settingsTarget)
  // Native Obsidian more-options lives in the tab title bar; recreate it in fallback.
  let moreTarget: HTMLElement | null = null
  if (hosts.placement === 'fallback' && options.onOpenMoreMenu) {
    moreTarget = document.createElement('div')
    moreTarget.className = 'foxycape-pdf-header-more'
    settingsTarget.after(moreTarget)
  }

  const teleportRoot = options.containerEl.createDiv({
    cls: 'foxycape-pdf-chrome-root',
  })
  teleportRoot.hidden = true

  // Reader / DOM hosts must not be Vue-proxied: pdf.js private methods break on Proxy.
  const state = reactive<ChromeState>({
    reader: markRaw(options.reader),
    t: options.t,
    sidebarOpen: options.sidebarOpen,
    settingsOpenNonce: 0,
    onToggleSidebar: options.onToggleSidebar,
    onRequestCloseSidebar: options.onRequestCloseSidebar,
    onOpenMoreMenu: options.onOpenMoreMenu,
    getViewPreferences: options.getViewPreferences,
    onUpdateViewPreferences: options.onUpdateViewPreferences,
    navTarget: markRaw(navTarget),
    pageTarget: markRaw(pageTarget),
    zoomTarget: markRaw(zoomTarget),
    settingsTarget: markRaw(settingsTarget),
    moreTarget: moreTarget ? markRaw(moreTarget) : null,
  })

  const chromeApp: App = createApp({
    setup: () => () =>
      h(PdfViewChromeApp, {
        reader: state.reader as Reader,
        t: state.t,
        sidebarOpen: state.sidebarOpen,
        settingsOpenNonce: state.settingsOpenNonce,
        onToggleSidebar: state.onToggleSidebar,
        onOpenMoreMenu: state.onOpenMoreMenu,
        getViewPreferences: state.getViewPreferences,
        onUpdateViewPreferences: state.onUpdateViewPreferences,
        navTarget: state.navTarget,
        pageTarget: state.pageTarget,
        zoomTarget: state.zoomTarget,
        settingsTarget: state.settingsTarget,
        moreTarget: state.moreTarget,
      } as any),
  })
  chromeApp.mount(teleportRoot)

  const sidebarApp: App = createApp({
    setup: () => () =>
      h(PdfLeftNavPanel, {
        reader: state.reader as Reader,
        t: state.t,
        open: state.sidebarOpen,
        onRequestClose: state.onRequestCloseSidebar,
      } as any),
  })
  sidebarApp.mount(options.sidebarHost)

  return {
    placement: hosts.placement,
    setSidebarOpen: (open: boolean) => {
      state.sidebarOpen = open
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
      zoomTarget.remove()
      settingsTarget.remove()
      moreTarget?.remove()
      hosts.fallbackToolbar?.remove()
      options.containerEl.removeClass('foxycape-pdf-chrome-fallback')
    },
  }
}
