export type MarkSortMode = 'progress' | 'updateDesc' | 'updateAsc'

export type NavGroupItem = {
  navUrl?: string
  navTitle?: string
  pageNumber?: number
  progress?: number
  updatedAt?: number
}

export type NavGroup<T extends NavGroupItem> = {
  key: string
  title: string
  items: T[]
}

export type NavHeaderRow = {
  id: string
  type: 'header'
  title: string
}

export type NavItemRow<T> = {
  id: string
  type: 'item'
  title: string
  item: T
  hideDivider: boolean
}

export type NavListRow<T> = NavHeaderRow | NavItemRow<T>

const hasNavInfo = (item: NavGroupItem) => Boolean(item.navUrl?.trim() || item.navTitle?.trim())

const navKey = (item: NavGroupItem) => item.navUrl?.trim() || item.navTitle?.trim() || ''

const groupTitle = (items: NavGroupItem[], ungroupedTitle: string) => {
  const titled = items.find((item) => item.navTitle?.trim())
  if (titled?.navTitle?.trim()) {
    return titled.navTitle.trim()
  }
  const linked = items.find((item) => item.navUrl?.trim())
  if (linked?.navUrl?.trim()) {
    return linked.navUrl.trim()
  }
  return ungroupedTitle
}

const progressOf = (item: NavGroupItem) =>
  typeof item.progress === 'number' ? item.progress : Number.POSITIVE_INFINITY

const pageOf = (item: NavGroupItem) =>
  typeof item.pageNumber === 'number' ? item.pageNumber : Number.POSITIVE_INFINITY

const compareByProgress = (a: NavGroupItem, b: NavGroupItem) => {
  const progress = progressOf(a) - progressOf(b)
  if (progress !== 0) {
    return progress
  }
  return pageOf(a) - pageOf(b)
}

const compareByUpdate = (a: NavGroupItem, b: NavGroupItem, direction: 1 | -1) => {
  const delta = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
  if (delta !== 0) {
    return delta * direction
  }
  return compareByProgress(a, b)
}

const sortItems = <T extends NavGroupItem>(items: T[], mode: MarkSortMode) =>
  [...items].sort((a, b) => {
    if (mode === 'updateDesc') {
      return compareByUpdate(a, b, -1)
    }
    if (mode === 'updateAsc') {
      return compareByUpdate(a, b, 1)
    }
    return compareByProgress(a, b)
  })

const groupOrder = (items: NavGroupItem[]) => {
  let minProgress = Number.POSITIVE_INFINITY
  let minPage = Number.POSITIVE_INFINITY
  for (const item of items) {
    minProgress = Math.min(minProgress, progressOf(item))
    minPage = Math.min(minPage, pageOf(item))
  }
  return { minProgress, minPage }
}

export const groupNavItems = <T extends NavGroupItem>(
  items: T[],
  mode: MarkSortMode,
  ungroupedTitle: string,
): NavGroup<T>[] => {
  if (items.length === 0) {
    return []
  }
  if (!items.some(hasNavInfo)) {
    return [{ key: '', title: '', items: sortItems(items, mode) }]
  }
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const key = navKey(item)
    const list = grouped.get(key)
    if (list) {
      list.push(item)
    } else {
      grouped.set(key, [item])
    }
  }
  const groups: NavGroup<T>[] = []
  let ungrouped: NavGroup<T> | undefined
  for (const [key, groupItems] of grouped) {
    const group: NavGroup<T> = {
      key,
      title: key ? groupTitle(groupItems, ungroupedTitle) : ungroupedTitle,
      items: sortItems(groupItems, mode),
    }
    if (!key) {
      ungrouped = group
      continue
    }
    groups.push(group)
  }
  groups.sort((a, b) => {
    const left = groupOrder(a.items)
    const right = groupOrder(b.items)
    if (left.minProgress !== right.minProgress) {
      return left.minProgress - right.minProgress
    }
    return left.minPage - right.minPage
  })
  if (ungrouped) {
    groups.push(ungrouped)
  }
  return groups
}

export const flattenNavGroups = <T extends NavGroupItem>(
  groups: NavGroup<T>[],
  idOf: (item: T) => string,
): NavListRow<T>[] => {
  const rows: NavListRow<T>[] = []
  for (const group of groups) {
    const groupKey = group.key || '__ungrouped__'
    if (group.title) {
      rows.push({
        id: `header:${groupKey}`,
        type: 'header',
        title: group.title,
      })
    }
    const lastIndex = group.items.length - 1
    for (let index = 0; index < group.items.length; index++) {
      const item = group.items[index]
      rows.push({
        id: idOf(item),
        type: 'item',
        title: group.title,
        item,
        hideDivider: index === lastIndex,
      })
    }
  }
  return rows
}
