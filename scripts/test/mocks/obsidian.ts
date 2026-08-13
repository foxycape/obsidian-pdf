type DomConstructor<T> = abstract new (...args: never[]) => T

const installObsidianDomHelpers = () => {
  const proto = Node.prototype as Node & {
    instanceOf?: <T>(type: DomConstructor<T>) => boolean
    createEl?: typeof document.createElement
    createDiv?: (options?: unknown) => HTMLDivElement
    createSpan?: (options?: unknown) => HTMLSpanElement
  }
  if (typeof proto.instanceOf !== 'function') {
    proto.instanceOf = function instanceOf<T>(
      this: Node,
      type: DomConstructor<T>,
    ): boolean {
      return this instanceof type
    }
  }
  if (typeof proto.createEl !== 'function') {
    proto.createEl = function createEl(
      this: Node,
      tag: string,
      options?: { cls?: string; text?: string; attr?: Record<string, string> },
    ) {
      const doc = this.ownerDocument ?? document
      const el = doc.createElement(tag)
      if (options?.cls) {
        el.className = options.cls
      }
      if (options?.text) {
        el.textContent = options.text
      }
      if (options?.attr) {
        for (const [key, value] of Object.entries(options.attr)) {
          el.setAttribute(key, value)
        }
      }
      if (this instanceof Element || this instanceof DocumentFragment) {
        this.appendChild(el)
      }
      return el
    } as typeof document.createElement
  }
  if (typeof proto.createDiv !== 'function') {
    proto.createDiv = function createDiv(this: Node, options?: unknown) {
      return (this as Element).createEl('div', options as never) as HTMLDivElement
    }
  }
  if (typeof proto.createSpan !== 'function') {
    proto.createSpan = function createSpan(this: Node, options?: unknown) {
      return (this as Element).createEl('span', options as never) as HTMLSpanElement
    }
  }
}

installObsidianDomHelpers()

export const createEl = (
  tag: string,
  options?: { cls?: string; text?: string; attr?: Record<string, string> },
) => {
  const el = document.createElement(tag)
  if (options?.cls) {
    el.className = options.cls
  }
  if (options?.text) {
    el.textContent = options.text
  }
  if (options?.attr) {
    for (const [key, value] of Object.entries(options.attr)) {
      el.setAttribute(key, value)
    }
  }
  return el
}

export const createDiv = (
  options?: { cls?: string; text?: string; attr?: Record<string, string> },
) => createEl('div', options) as HTMLDivElement

export const createSpan = (
  options?: { cls?: string; text?: string; attr?: Record<string, string> },
) => createEl('span', options) as HTMLSpanElement

export class Plugin {
  app = {
    workspace: {
      getLeavesOfType: () => [],
      getLeaf: () => ({
        setViewState: async () => undefined,
      }),
      revealLeaf: () => undefined,
      setActiveLeaf: () => undefined,
      detachLeavesOfType: () => undefined,
      openLinkText: async () => undefined,
      handleLinkContextMenu: () => false,
    },
    metadataCache: {
      getFirstLinkpathDest: () => null,
    },
  }

  registerView = () => undefined
  addCommand = () => undefined
  register = () => undefined
}

export class ItemView {
  contentEl = {
    empty: () => undefined,
    addClass: () => undefined,
    createDiv: () => document.createElement('div'),
  }

  constructor(_leaf: unknown) {}
}

export class FileView extends ItemView {
  file: { path: string } | null = null
}

export type WorkspaceLeaf = {
  view?: unknown
  activeTime?: number
  setEphemeralState?: (state: unknown) => void
  getViewState?: () => { type?: string; state?: Record<string, unknown> }
}

export type App = {
  workspace: Plugin['app']['workspace']
  metadataCache: Plugin['app']['metadataCache']
}

export type TFile = {
  path: string
  extension: string
}

export type OpenViewState = {
  state?: Record<string, unknown>
  eState?: Record<string, unknown>
  active?: boolean
}

export type PaneType = 'tab' | 'split' | 'window'

export const Platform = {
  isDesktopApp: false,
  isMobile: false,
}

export const requestUrl = async (_request?: unknown) => ({
  status: 0,
  headers: {} as Record<string, string>,
  arrayBuffer: new ArrayBuffer(0),
  json: {},
  text: '',
})

export const parseLinktext = (linktext: string): { path: string; subpath: string } => {
  const hashIndex = linktext.indexOf('#')
  if (hashIndex < 0) {
    return { path: linktext, subpath: '' }
  }
  return {
    path: linktext.slice(0, hashIndex),
    subpath: linktext.slice(hashIndex),
  }
}
