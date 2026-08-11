/**
 * Vitest/jsdom lacks Obsidian DOM helpers (`instanceOf`, `createEl`, …).
 * Install minimal shims so production code can keep review-compliant APIs.
 */
type DomConstructor<T> = abstract new (...args: never[]) => T

const proto = Node.prototype as Node & {
  instanceOf?: <T>(type: DomConstructor<T>) => boolean
  createEl?: (tag: string, options?: unknown) => HTMLElement
  createDiv?: (options?: unknown) => HTMLDivElement
  createSpan?: (options?: unknown) => HTMLSpanElement
  setCssStyles?: (styles: Partial<CSSStyleDeclaration>) => void
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
  }
}

if (typeof proto.createDiv !== 'function') {
  proto.createDiv = function createDiv(this: Node, options?: unknown) {
    return this.createEl!('div', options) as HTMLDivElement
  }
}

if (typeof proto.createSpan !== 'function') {
  proto.createSpan = function createSpan(this: Node, options?: unknown) {
    return this.createEl!('span', options) as HTMLSpanElement
  }
}

if (typeof proto.setCssStyles !== 'function') {
  proto.setCssStyles = function setCssStyles(
    this: Node,
    styles: Partial<CSSStyleDeclaration>,
  ) {
    if (!(this instanceof HTMLElement)) {
      return
    }
    Object.assign(this.style, styles)
  }
}
