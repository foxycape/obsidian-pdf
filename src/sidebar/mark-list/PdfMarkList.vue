<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Notice } from 'obsidian'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { EventNames, Theme, type Reader } from '@foxycape/core/kernal'
import type { IMarker, Mark } from '@/mark'
import type { MarkDataChangePayload } from '@/marker/PdfMarker'
import { DEFAULT_MARK_COLORS } from '@/marker/PdfMarkConstants'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'
import PdfMarkListItem from './PdfMarkListItem.vue'
import { flattenNavGroups, groupNavItems, type MarkSortMode } from './markListGroup'

type FilterKind = 'mark_pen' | 'wavy_line' | 'underline_straight'

const props = defineProps<{
  reader: Reader
  getMarker: () => IMarker | undefined
  active: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  onClose: () => void
}>()

const keyword = ref('')
const marks = ref<Mark[]>([])
const loading = ref(true)
const sortMode = ref<MarkSortMode>('progress')
const sortMenuOpen = ref(false)
const filterOpen = ref(false)
const searchOpen = ref(false)
const searchInputEl = ref<HTMLInputElement | null>(null)
const sortMenuRoot = ref<HTMLElement | null>(null)
const searchMenuRoot = ref<HTMLElement | null>(null)
const activeKinds = ref<FilterKind[]>([])
const activeColors = ref<string[]>([])

const sortOptions = computed(() => [
  { mode: 'progress' as const, label: props.t('pdf_mark_list_sort_progress', 'Reading order') },
  { mode: 'updateDesc' as const, label: props.t('pdf_mark_list_sort_update_desc', 'Updated · newest') },
  { mode: 'updateAsc' as const, label: props.t('pdf_mark_list_sort_update_asc', 'Updated · oldest') },
])

const kindOptions = computed(() => [
  { kind: 'mark_pen' as const, icon: 'highlighter', label: props.t('toolbar_mark_pen', 'Highlight') },
  { kind: 'wavy_line' as const, icon: 'spell-check-2', label: props.t('toolbar_wavy_line', 'Wavy line') },
  { kind: 'underline_straight' as const, icon: 'baseline', label: props.t('toolbar_underline', 'Underline') },
])

const colorOf = (mark: Mark) =>
  (mark.customColor || DEFAULT_MARK_COLORS[mark.styleName] || DEFAULT_MARK_COLORS.mark_pen).toLowerCase()

const matchesKind = (mark: Mark, kind: FilterKind) => {
  const style = mark.styleName || ''
  return style === kind || style.startsWith(`${kind}-`) || style.startsWith(`${kind}_`)
}

const matchesKeyword = (mark: Mark, key: string) => {
  if (!key) {
    return true
  }
  return mark.text.toLowerCase().includes(key)
}

const usedColors = computed(() => {
  const source =
    activeKinds.value.length === 0
      ? marks.value
      : marks.value.filter((mark) => activeKinds.value.some((kind) => matchesKind(mark, kind)))
  return [...new Set(source.map(colorOf))]
})

const hasActiveFilters = computed(() => activeKinds.value.length > 0 || activeColors.value.length > 0)

watch(usedColors, (colors) => {
  activeColors.value = activeColors.value.filter((color) => colors.includes(color))
})

const visibleMarks = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return marks.value.filter((mark) => {
    if (!matchesKeyword(mark, key)) {
      return false
    }
    if (activeKinds.value.length > 0 && !activeKinds.value.some((kind) => matchesKind(mark, kind))) {
      return false
    }
    if (activeColors.value.length > 0 && !activeColors.value.includes(colorOf(mark))) {
      return false
    }
    return true
  })
})

const rows = computed(() =>
  flattenNavGroups(
    groupNavItems(visibleMarks.value, sortMode.value, props.t('pdf_mark_list_ungrouped', 'Ungrouped')),
    (mark) => mark.markId,
  ),
)

const stickyTitle = ref('')
const listRoot = ref<HTMLElement | null>(null)
const scrollerRef = ref<{
  findItemIndex?: (scrollTop: number) => number
  getItemOffset?: (index: number) => number
} | null>(null)

const syncStickyTitle = () => {
  const scroller = scrollerRef.value
  const scrollTop = listRoot.value?.querySelector<HTMLElement>('.vue-recycle-scroller')?.scrollTop ?? 0
  const items = rows.value
  if (!scroller?.findItemIndex || items.length === 0) {
    stickyTitle.value = ''
    return
  }
  const index = Math.min(Math.max(scroller.findItemIndex(scrollTop), 0), items.length - 1)
  const row = items[index]
  if (!row?.title) {
    stickyTitle.value = ''
    return
  }
  if (row.type === 'header') {
    const offset = scroller.getItemOffset?.(index) ?? 0
    stickyTitle.value = scrollTop > offset + 1 ? row.title : ''
    return
  }
  stickyTitle.value = row.title
}

watch(rows, async () => {
  stickyTitle.value = ''
  await nextTick()
  syncStickyTitle()
})

const isFilterEmpty = computed(
  () => marks.value.length > 0 && visibleMarks.value.length === 0 && (Boolean(keyword.value.trim()) || hasActiveFilters.value),
)

const doSearch = async () => {
  const marker = props.getMarker()
  if (!marker) {
    marks.value = []
    loading.value = false
    return
  }
  const result = await marker.getMarks({ types: ['drawline'] })
  marks.value = await marker.ensureNavMeta(result)
  loading.value = false
}

const onSearchInput = (event: Event) => {
  keyword.value = (event.target as HTMLInputElement).value
}

const closeSortMenu = () => {
  sortMenuOpen.value = false
}

const closeSearch = () => {
  searchOpen.value = false
}

const toggleFilter = () => {
  filterOpen.value = !filterOpen.value
  if (filterOpen.value) {
    closeSortMenu()
    return
  }
  closeSearch()
}

const toggleSearch = async () => {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    closeSortMenu()
    await nextTick()
    searchInputEl.value?.focus()
  }
}

const applySort = (mode: MarkSortMode) => {
  sortMode.value = mode
  sortMenuOpen.value = false
}

const toggleSortMenu = () => {
  sortMenuOpen.value = !sortMenuOpen.value
  if (sortMenuOpen.value) {
    closeSearch()
  }
}

const toggleKind = (kind: FilterKind) => {
  activeKinds.value = activeKinds.value.includes(kind)
    ? activeKinds.value.filter((item) => item !== kind)
    : [...activeKinds.value, kind]
}

const toggleColor = (color: string) => {
  activeColors.value = activeColors.value.includes(color)
    ? activeColors.value.filter((item) => item !== color)
    : [...activeColors.value, color]
}

const clearFilters = () => {
  activeKinds.value = []
  activeColors.value = []
  keyword.value = ''
  closeSearch()
}

useDismissOnOutside(
  () => sortMenuOpen.value,
  () => [sortMenuRoot.value],
  closeSortMenu,
)
useDismissOnOutside(
  () => searchOpen.value,
  () => [searchMenuRoot.value],
  closeSearch,
)

const onMarkDataChange = (payload: MarkDataChangePayload) => {
  if (payload?.dataType !== 'mark') {
    return
  }
  for (const item of payload.items || []) {
    if (item.type && item.type !== 'drawline') {
      continue
    }
    if (payload.action === 'create') {
      if (marks.value.some((mark) => mark.markId === item.markId)) {
        continue
      }
      marks.value = [item, ...marks.value]
      void props.getMarker()?.ensureNavMeta([item]).then((filled) => {
        const next = filled[0]
        if (!next) {
          return
        }
        const index = marks.value.findIndex((mark) => mark.markId === next.markId)
        if (index >= 0) {
          marks.value.splice(index, 1, next)
        }
      })
    } else if (payload.action === 'delete') {
      const index = marks.value.findIndex((mark) => mark.markId === item.markId)
      if (index >= 0) {
        marks.value.splice(index, 1)
      }
    } else if (payload.action === 'update') {
      const index = marks.value.findIndex((mark) => mark.markId === item.markId)
      if (index >= 0) {
        marks.value.splice(index, 1, item)
      } else {
        marks.value = [item, ...marks.value]
      }
    }
  }
}

const onDeleted = () => {
  new Notice(props.t('pdf_mark_list_deleted', 'Highlight deleted'))
}

const onNavigated = () => {
  if (isObsidianMobile()) {
    props.onClose()
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      void doSearch()
    } else {
      closeSortMenu()
      closeSearch()
    }
  },
)

watch(
  () => props.reader,
  (reader, prev) => {
    prev?.events.off(EventNames.DataChange, onMarkDataChange)
    reader.events.on(EventNames.DataChange, onMarkDataChange)
    void doSearch()
  },
)

onMounted(() => {
  props.reader.events.on(EventNames.DataChange, onMarkDataChange)
  void doSearch()
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.DataChange, onMarkDataChange)
})
</script>

<template>
  <div class="foxycape-pdf-mark-list">
    <div class="nav-header foxycape-pdf-mark-list__header">
      <div class="foxycape-pdf-mark-list__title">
        <span>{{ t('pdf_mark_list_title', 'Highlights') }}</span>
        <span v-if="visibleMarks.length > 0" class="foxycape-pdf-mark-list__count">
          {{ visibleMarks.length }}
        </span>
      </div>
      <div class="nav-buttons-container foxycape-pdf-mark-list__actions">
        <ClickableIconButton
          icon="list-filter"
          :class-name="['nav-action-button force-small-icon', { 'is-active': filterOpen || hasActiveFilters || Boolean(keyword.trim()) }]"
          :label="t('pdf_mark_list_filter', 'Filter marks')"
          :aria-expanded="filterOpen"
          :aria-pressed="hasActiveFilters"
          @click="toggleFilter"
        />
        <div ref="sortMenuRoot" class="foxycape-pdf-mark-list__sort">
          <ClickableIconButton
            icon="arrow-up-down"
            :class-name="['nav-action-button force-small-icon', { 'is-active': sortMenuOpen }]"
            :label="t('pdf_mark_list_sort', 'Sort')"
            :aria-expanded="sortMenuOpen"
            @click="toggleSortMenu"
          />
          <div v-if="sortMenuOpen" class="foxycape-pdf-mark-list__sort-menu" role="menu" @pointerdown.stop>
            <button
              v-for="option in sortOptions"
              :key="option.mode"
              type="button"
              class="foxycape-pdf-mark-list__sort-item"
              :class="{ 'is-active': sortMode === option.mode }"
              role="menuitemradio"
              :aria-checked="sortMode === option.mode"
              @click="applySort(option.mode)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <ClickableIconButton icon="x" class-name="nav-action-button" :label="t('pdf_mark_list_close', 'Close')" @click="onClose" />
      </div>
    </div>

    <div v-if="filterOpen && marks.length > 0" class="foxycape-pdf-mark-list__filter">
      <div class="foxycape-pdf-mark-list__kinds">
        <ClickableIconButton
          v-for="option in kindOptions"
          :key="option.kind"
          :icon="option.icon"
          :class-name="['foxycape-pdf-mark-list__kind', { 'is-active': activeKinds.includes(option.kind) }]"
          :label="option.label"
          :aria-pressed="activeKinds.includes(option.kind)"
          @click="toggleKind(option.kind)"
        />
      </div>
      <div ref="searchMenuRoot" class="foxycape-pdf-mark-list__search">
        <ClickableIconButton
          icon="search"
          :class-name="['nav-action-button force-small-icon', { 'is-active': searchOpen || Boolean(keyword.trim()) }]"
          :label="t('pdf_mark_list_search', 'Filter highlights')"
          :aria-expanded="searchOpen"
          @click="toggleSearch"
        />
        <div v-if="searchOpen" class="foxycape-pdf-mark-list__search-pop" @pointerdown.stop>
          <input
            ref="searchInputEl"
            type="search"
            spellcheck="false"
            :value="keyword"
            :placeholder="t('pdf_mark_list_search', 'Filter highlights')"
            :aria-label="t('pdf_mark_list_search', 'Filter highlights')"
            @input="onSearchInput"
          />
        </div>
      </div>
      <div v-if="usedColors.length > 1" class="foxycape-pdf-mark-list__colors">
        <button
          v-for="color in usedColors"
          :key="color"
          type="button"
          class="foxycape-pdf-mark-list__color"
          :class="{ 'is-active': activeColors.includes(color) }"
          :style="{ background: color }"
          :aria-label="color"
          :aria-pressed="activeColors.includes(color)"
          @click="toggleColor(color)"
        />
      </div>
      <button v-if="hasActiveFilters || keyword.trim()" type="button" class="foxycape-pdf-mark-list__clear" @click="clearFilters">
        {{ t('pdf_mark_list_clear_filters', 'Clear filters') }}
      </button>
    </div>

    <div ref="listRoot" class="foxycape-pdf-mark-list__body" @scroll.passive.capture="syncStickyTitle">
      <h3 v-if="stickyTitle" class="foxycape-pdf-mark-list__group foxycape-pdf-mark-list__sticky">{{ stickyTitle }}</h3>
      <DynamicScroller
        v-if="rows.length > 0"
        ref="scrollerRef"
        :class="['foxycape-pdf-mark-list__scroller', `${Theme.customScrollerClassName}`]"
        :items="rows"
        :min-item-size="36"
        key-field="id"
        :emit-update="true"
        @update="syncStickyTitle"
      >
        <template #default="{ item, index, active: itemActive }">
          <DynamicScrollerItem
            :item="item"
            :active="itemActive"
            :data-index="index"
            :size-dependencies="[item.type === 'item' ? item.item.text : item.title]"
            class="foxycape-pdf-mark-list__scroller-item"
          >
            <h3
              v-if="item.type === 'header'"
              class="foxycape-pdf-mark-list__group"
              :class="{ 'is-follow': index > 0 }"
            >{{ item.title }}</h3>
            <PdfMarkListItem
              v-else
              :mark="item.item"
              :hide-divider="item.hideDivider"
              :get-marker="getMarker"
              :t="t"
              @deleted="onDeleted"
              @navigated="onNavigated"
            />
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

      <div v-else class="foxycape-pdf-mark-list__empty">
        {{
          loading
            ? t('share_loading_text', 'Loading...')
            : isFilterEmpty
              ? t('pdf_mark_list_filter_empty', 'No highlights match the filter')
              : t('pdf_mark_list_empty', 'No highlights')
        }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.foxycape-pdf-mark-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.foxycape-pdf-mark-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-inline: 10px 6px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--background-modifier-border);
}

.foxycape-pdf-mark-list__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: 600;
}

.foxycape-pdf-mark-list__count {
  color: var(--text-muted);
  font-weight: 500;
}

.foxycape-pdf-mark-list__actions {
  flex: 0 0 auto;
}

.foxycape-pdf-mark-list__actions .is-active,
.foxycape-pdf-mark-list__search .is-active {
  color: var(--text-accent);
}

.foxycape-pdf-mark-list__filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.foxycape-pdf-mark-list__kinds {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.foxycape-pdf-mark-list__kind.is-active {
  color: var(--text-accent);
  background: var(--background-modifier-hover);
}

.foxycape-pdf-mark-list__search {
  position: relative;
  flex: 0 0 auto;
}

.foxycape-pdf-mark-list__search-pop {
  position: absolute;
  inset-block-start: calc(100% + 4px);
  inset-inline-end: 0;
  z-index: 20;
  width: 220px;
  padding: 8px;
  border-radius: var(--radius-m);
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.foxycape-pdf-mark-list__search-pop input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
}

.foxycape-pdf-mark-list__search-pop input:focus,
.foxycape-pdf-mark-list__search-pop input:focus-visible {
  border-color: var(--background-modifier-border);
  box-shadow: none;
  outline: none;
}

.foxycape-pdf-mark-list__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.foxycape-pdf-mark-list__color {
  flex: none;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  min-width: 16px;
  max-width: 16px;
  min-height: 16px;
  max-height: 16px;
  aspect-ratio: 1;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: none;
  cursor: pointer;
}

.foxycape-pdf-mark-list__color.is-active {
  border-color: var(--text-normal);
}

.foxycape-pdf-mark-list__clear {
  border: 0;
  background: transparent;
  color: var(--text-accent);
  font-size: var(--font-ui-smaller);
  padding: 0;
  cursor: pointer;
  box-shadow: none;
}

.foxycape-pdf-mark-list__group {
  margin: 0;
  padding: 6px 12px;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-weight: 400;
}

.foxycape-pdf-mark-list__group.is-follow {
  padding-top: 18px;
}

.foxycape-pdf-mark-list__body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.foxycape-pdf-mark-list__sticky {
  position: absolute;
  inset-inline: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  background: var(--background-secondary);
}

.foxycape-pdf-mark-list__sort {
  position: relative;
  flex: 0 0 auto;
}

.foxycape-pdf-mark-list__sort-menu {
  position: absolute;
  inset-block-start: calc(100% + 4px);
  inset-inline-end: 0;
  z-index: 20;
  min-width: 160px;
  padding: 4px;
  border-radius: var(--radius-m);
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.foxycape-pdf-mark-list__sort-item {
  display: block;
  width: 100%;
  border: none;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  text-align: start;
  padding-block: 6px;
  padding-inline: 8px;
  cursor: pointer;
  box-shadow: none;
}

.foxycape-pdf-mark-list__sort-item:hover {
  background: var(--background-modifier-hover);
}

.foxycape-pdf-mark-list__sort-item.is-active {
  color: var(--text-accent);
  font-weight: 600;
}

.foxycape-pdf-mark-list__scroller {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.foxycape-pdf-mark-list__scroller.vue-recycle-scroller {
  position: relative;
}

.foxycape-pdf-mark-list__scroller .vue-recycle-scroller__item-wrapper,
.foxycape-pdf-mark-list__scroller .vue-recycle-scroller__item-view {
  box-sizing: border-box;
  width: 100%;
}

.foxycape-pdf-mark-list__scroller-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

.foxycape-pdf-mark-list__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  padding-block: 24px;
  padding-inline: 12px;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  text-align: center;
}

.nav-action-button.force-small-icon :deep(svg) {
  width: var(--icon-s);
  height: var(--icon-s);
}
</style>
