<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  EventNames,
  Theme,
  type Nav,
  type NavPoint,
  type PageChangeOptions,
  type Reader,
} from '@core/kernal'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import PdfTocNode, { type TocNode } from './PdfTocNode.vue'

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string) => string
  /** Called after a TOC entry navigates (e.g. close floating panel on mobile). */
  onAfterNavigate?: () => void
}>()

const nodes = ref<TocNode[]>([])
/** Actual located nav point key from reading position. */
const activeKey = ref('')
/** Visible highlight key; may be an ancestor when active node is inside a collapsed folder. */
const selectedKey = ref('')
const expandKeys = ref<string[]>([])

const findTopNavPoints = (nav: Nav) => {
  let roots = nav.navPoints ?? []
  while (roots.length === 1 && (roots[0].children?.length ?? 0) > 0) {
    roots = roots[0].children
  }
  return roots
}

const buildNode = (navPoint: NavPoint, parent?: TocNode): TocNode => {
  const node: TocNode = {
    key: navPoint.key,
    label: navPoint.title || navPoint.url || '',
    pageNumber: navPoint.startPageNumber > 0 ? navPoint.startPageNumber : 0,
    navPoint,
    children: [],
    parent,
    expanded: false,
  }
  if (navPoint.children?.length) {
    node.children = navPoint.children.map((child) => buildNode(child, node))
  }
  return node
}

const findNode = (list: TocNode[], key: string): TocNode | null => {
  for (const node of list) {
    if (node.key === key) {
      return node
    }
    const child = findNode(node.children, key)
    if (child) {
      return child
    }
  }
  return null
}

const applyExpandedKeys = (list: TocNode[], keys: Set<string>) => {
  for (const node of list) {
    if (node.children.length) {
      node.expanded = keys.has(node.key)
      applyExpandedKeys(node.children, keys)
    }
  }
}

/** Walk up until the node is visible (all ancestors expanded, or root). */
const resolveVisibleKey = (node: TocNode | null) => {
  if (!node) {
    return ''
  }
  let current = node
  while (current.parent && !current.parent.expanded) {
    current = current.parent
  }
  return current.key
}

const updateSelectedFromActive = () => {
  selectedKey.value = resolveVisibleKey(findNode(nodes.value, activeKey.value))
}

const buildTree = async () => {
  const fileParser = props.reader.getFileParser?.()
  if (!fileParser?.getNav) {
    nodes.value = []
    selectedKey.value = ''
    return
  }
  const nav = await fileParser.getNav()
  const nextNodes = findTopNavPoints(nav).map((item) => buildNode(item))
  // Keep manually expanded folders across rebuilds; locating never changes them.
  applyExpandedKeys(nextNodes, new Set(expandKeys.value))
  nodes.value = nextNodes
  updateSelectedFromActive()
}

const syncCurrentNavPoint = async () => {
  const renderer = getPdfRenderer(props.reader)
  const current = await renderer?.navPointProvider?.getCurrentNavPoint?.()
  activeKey.value = current?.key ?? ''
  updateSelectedFromActive()
}

const toggleExpand = (node: TocNode) => {
  node.expanded = !node.expanded
  if (node.expanded) {
    if (!expandKeys.value.includes(node.key)) {
      expandKeys.value = [...expandKeys.value, node.key]
    }
  } else {
    expandKeys.value = expandKeys.value.filter((key) => key !== node.key)
  }
  // Expanding/collapsing may reveal or hide the active item; refresh highlight.
  updateSelectedFromActive()
}

const onSelect = async (node: TocNode) => {
  selectedKey.value = node.key
  const navPoint = node.navPoint as NavPoint | undefined
  if (!navPoint) {
    return
  }
  const fileParser = props.reader.getFileParser?.()
  if (!fileParser?.buildLocation) {
    const renderer = getPdfRenderer(props.reader)
    await renderer?.navPointNavigator?.gotoNavPoint(navPoint)
    props.onAfterNavigate?.()
    return
  }
  const location = await fileParser.buildLocation(navPoint)
  location.from = 'toc'
  location.storeCurrent = true
  await props.reader.goto(location)
  props.onAfterNavigate?.()
}

const onPageChange = async (_options: PageChangeOptions) => {
  await syncCurrentNavPoint()
}

onMounted(async () => {
  await buildTree()
  await syncCurrentNavPoint()
  props.reader.events.on(EventNames.PageChange, onPageChange)
  props.reader.events.on(EventNames.PdfPagesInit, buildTree)
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.PageChange, onPageChange)
  props.reader.events.off(EventNames.PdfPagesInit, buildTree)
})

watch(
  () => props.reader,
  async () => {
    await buildTree()
    await syncCurrentNavPoint()
  },
)
</script>

<template>
  <div :class="['foxycape-pdf-toc', `${Theme.customScrollerClassName}`]">
    <div v-if="!nodes.length" class="foxycape-pdf-toc__empty">
      {{ t('pdf_chrome_toc_empty', 'No table of contents') }}
    </div>
    <ul v-else class="foxycape-pdf-toc__list">
      <PdfTocNode
        v-for="node in nodes"
        :key="node.key"
        :node="node"
        :selected-key="selectedKey"
        @select="onSelect"
        @toggle="toggleExpand"
      />
    </ul>
  </div>
</template>

<style scoped>
.foxycape-pdf-toc {
  height: 100%;
  overflow: auto;
  padding-block: 8px 12px;
  padding-inline: 4px;
}

.foxycape-pdf-toc__empty {
  padding-block: 16px;
  padding-inline: 12px;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
}

.foxycape-pdf-toc__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
