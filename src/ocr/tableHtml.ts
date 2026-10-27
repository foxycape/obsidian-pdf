const TABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'])

type CreateElWindow = Window & {
  createEl<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K]
  createDiv(): HTMLDivElement
}

const ownerWindow = (node: Node): CreateElWindow => node.win as CreateElWindow

const createDetached = <K extends keyof HTMLElementTagNameMap>(
  node: Node,
  tag: K,
): HTMLElementTagNameMap[K] => {
  const created = ownerWindow(node).createEl(tag)
  created.detach()
  return created
}

const cellText = (cell: Element): string => {
  const clone = cell.cloneNode(true) as Element
  clone.querySelectorAll('script, style').forEach((node) => node.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const escapeCell = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const appendSanitized = (source: Element, target: Element) => {
  if (!TABLE_TAGS.has(source.tagName)) {
    return
  }
  const copy = createDetached(source, source.tagName.toLowerCase() as keyof HTMLElementTagNameMap)
  if (source.tagName === 'TH' || source.tagName === 'TD') {
    for (const name of ['colspan', 'rowspan']) {
      const value = source.getAttribute(name)
      if (value && /^\d+$/.test(value)) {
        copy.setAttribute(name, value)
      }
    }
    copy.textContent = cellText(source)
    target.append(copy)
    return
  }
  for (const child of source.children) {
    appendSanitized(child, copy)
  }
  if (copy.childNodes.length > 0) {
    target.append(copy)
  }
}

/** Keep only a table structure. Cell text is plain text. */
export const sanitizeTableHtml = (html: string): string => {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const table = parsed.querySelector('table')
  if (!table) {
    return ''
  }
  const host = ownerWindow(parsed).createDiv()
  host.detach()
  appendSanitized(table, host)
  return host.innerHTML
}

const markdownRows = (table: Element): string[][] => {
  const rows: string[][] = []
  for (const row of table.querySelectorAll('tr')) {
    const cells = [...row.children].filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
    if (cells.length === 0) {
      continue
    }
    rows.push(cells.map((cell) => escapeCell(cellText(cell))))
  }
  return rows
}

/** Convert the first HTML table into a GitHub-flavored Markdown table. */
export const tableHtmlToMarkdown = (html: string): string => {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const table = parsed.querySelector('table')
  if (!table) {
    return ''
  }
  const rows = markdownRows(table)
  if (rows.length === 0) {
    return ''
  }
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const padded = rows.map((row) => {
    const next = row.slice()
    while (next.length < width) {
      next.push('')
    }
    return next
  })
  const header = padded[0]
  const divider = header.map(() => '---')
  const body = padded.slice(1)
  const line = (row: string[]) => `| ${row.join(' | ')} |`
  return [line(header), line(divider), ...body.map(line)].join('\n')
}
