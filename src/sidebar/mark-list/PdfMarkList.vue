<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Notice } from 'obsidian'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import {
  debounce,
  EventNames,
  Theme,
  type IMarker,
  type Reader,
} from '@core/kernal'
import type { Mark } from '@core/kernal/mark/Mark'
import type { MarkDataChangePayload } from '@/marker/PdfMarker'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import ObsidianIcon from '@/ui/ObsidianIcon.vue'
import { isObsidianMobile } from '@/ui/isObsidianMobile'
import PdfMarkListItem from './PdfMarkListItem.vue'

type SortField = 'updateTime' | 'createTime'
type SortType = 'asc' | 'desc'

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
const sortField = ref<SortField>('updateTime')
const sortType = ref<SortType>('desc')
const sortMenuOpen = ref(false)
const searchOpen = ref(false)
const searchInputEl = ref<HTMLInputElement | null>(null)

const sortOptions = computed(() => [
  {
    field: 'updateTime' as const,
    type: 'desc' as const,
    label: props.t('pdf_mark_list_sort_update_desc', 'Updated · newest'),
  },
  {
    field: 'updateTime' as const,
    type: 'asc' as const,
    label: props.t('pdf_mark_list_sort_update_asc', 'Updated · oldest'),
  },
  {
    field: 'createTime' as const,
    type: 'desc' as const,
    label: props.t('pdf_mark_list_sort_create_desc', 'Created · newest'),
  },
  {
    field: 'createTime' as const,
    type: 'asc' as const,
    label: props.t('pdf_mark_list_sort_create_asc', 'Created · oldest'),
  },
])

const sortMarks = (items: Mark[]) => {
  const field = sortField.value
  const type = sortType.value
  return [...items].sort((a, b) => {
    const av = new Date(a[field]).getTime()
    const bv = new Date(b[field]).getTime()
    if (av === bv) {
      return 0
    }
    return type === 'asc' ? av - bv : bv - av
  })
}

const matchesKeyword = (mark: Mark, key: string) => {
  if (!key) {
    return true
  }
  return mark.text.toLowerCase().includes(key)
}

const doSearch = async () => {
  const marker = props.getMarker()
  if (!marker) {
    marks.value = []
    loading.value = false
    return
  }
  const key = keyword.value.trim()
  const result = await marker.getMarks({
    keyword: key || undefined,
    types: ['drawline'],
  })
  marks.value = sortMarks(result)
  loading.value = false
}

const delaySearch = debounce(() => {
  void doSearch()
}, 300)

const onSearchInput = (event: Event) => {
  keyword.value = (event.target as HTMLInputElement).value
  delaySearch()
}

const clearSearch = () => {
  keyword.value = ''
  void doSearch()
}

const toggleSearch = async () => {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    closeSortMenu()
    await nextTick()
    searchInputEl.value?.focus()
    return
  }
  if (keyword.value) {
    keyword.value = ''
    void doSearch()
  }
}

const applySort = (field: SortField, type: SortType) => {
  sortField.value = field
  sortType.value = type
  sortMenuOpen.value = false
  marks.value = sortMarks(marks.value)
}

const toggleSortMenu = () => {
  sortMenuOpen.value = !sortMenuOpen.value
}

const closeSortMenu = () => {
  sortMenuOpen.value = false
}

const onDocumentPointerDown = (event: PointerEvent) => {
  if (!sortMenuOpen.value) {
    return
  }
  const target = event.target as Node | null
  const root = sortMenuRoot.value
  if (root && target && root.contains(target)) {
    return
  }
  closeSortMenu()
}

const sortMenuRoot = ref<HTMLElement | null>(null)

const onMarkDataChange = (payload: MarkDataChangePayload) => {
  if (payload?.dataType !== 'mark') {
    return
  }
  const key = keyword.value.trim().toLowerCase()
  for (const item of payload.items || []) {
    if (item.type && item.type !== 'drawline') {
      continue
    }
    if (payload.action === 'create') {
      if (!matchesKeyword(item, key)) {
        continue
      }
      if (marks.value.some((m) => m.markId === item.markId)) {
        continue
      }
      marks.value = [item, ...marks.value]
    } else if (payload.action === 'delete') {
      const index = marks.value.findIndex((m) => m.markId === item.markId)
      if (index >= 0) {
        marks.value.splice(index, 1)
      }
    } else if (payload.action === 'update') {
      const index = marks.value.findIndex((m) => m.markId === item.markId)
      if (!matchesKeyword(item, key)) {
        if (index >= 0) {
          marks.value.splice(index, 1)
        }
        continue
      }
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
      searchOpen.value = false
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
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  void doSearch()
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.DataChange, onMarkDataChange)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})
</script>

<template>
  <div class="foxycape-pdf-mark-list">
    <div class="nav-header foxycape-pdf-mark-list__header">
      <div class="foxycape-pdf-mark-list__title">
        <span>{{ t('pdf_mark_list_title', 'Highlights') }}</span>
        <span v-if="marks.length > 0" class="foxycape-pdf-mark-list__count">
          {{ marks.length }}
        </span>
      </div>
      <div class="nav-buttons-container foxycape-pdf-mark-list__actions">
        <ClickableIconButton icon="search"
          :class-name="['nav-action-button force-small-icon', { 'is-active': searchOpen }]"
          :label="t('pdf_mark_list_search', 'Filter highlights')" :aria-expanded="searchOpen" @click="toggleSearch" />
        <div ref="sortMenuRoot" class="foxycape-pdf-mark-list__sort">
          <ClickableIconButton icon="arrow-up-down"
            :class-name="['nav-action-button force-small-icon', { 'is-active': sortMenuOpen }]"
            :label="t('pdf_mark_list_sort', 'Sort')" :aria-expanded="sortMenuOpen" @click="toggleSortMenu" />
          <div v-if="sortMenuOpen" class="foxycape-pdf-mark-list__sort-menu" role="menu">
            <button v-for="option in sortOptions" :key="`${option.field}-${option.type}`" type="button"
              class="foxycape-pdf-mark-list__sort-item" :class="{
                'is-active':
                  sortField === option.field && sortType === option.type,
              }" role="menuitemradio" :aria-checked="sortField === option.field && sortType === option.type
                " @click="applySort(option.field, option.type)">
              {{ option.label }}
            </button>
          </div>
        </div>
        <ClickableIconButton icon="x" class-name="nav-action-button" :label="t('pdf_mark_list_close', 'Close')"
          @click="onClose" />
      </div>
    </div>

    <div v-if="searchOpen" class="foxycape-pdf-mark-list__search-bar">
      <div class="search-input-container">
        <input ref="searchInputEl" type="search" spellcheck="false" :value="keyword" :placeholder="t('pdf_mark_list_search', 'Filter {count} highlights', {
          count: marks.length,
        })
          " :aria-label="t('pdf_mark_list_search', 'Filter highlights')" @input="onSearchInput" />
        <div class="search-input-clear-button" :aria-label="t('pdf_mark_list_clear', 'Clear')" @click="clearSearch">
        </div>

      </div>
    </div>

    <DynamicScroller v-if="marks.length > 0"
      :class="['foxycape-pdf-mark-list__scroller', `${Theme.customScrollerClassName}`]" :items="marks"
      :min-item-size="72" key-field="markId">
      <template #default="{ item, index, active: itemActive }">
        <DynamicScrollerItem :item="item" :active="itemActive" :data-index="index" :size-dependencies="[item.text]"
          class="foxycape-pdf-mark-list__scroller-item">
          <PdfMarkListItem :mark="item" :get-marker="getMarker" :t="t" @deleted="onDeleted" @navigated="onNavigated" />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <div v-else class="foxycape-pdf-mark-list__empty">
      {{
        loading
          ? t('share_loading_text', 'Loading...')
          : t('pdf_mark_list_empty', 'No highlights')
      }}
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

.foxycape-pdf-mark-list__actions .is-active {
  color: var(--text-accent);
}

.foxycape-pdf-mark-list__search-bar {
  display: flex;
  align-items: center;
  padding: 8px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--background-modifier-border);
}

.search-input-container {
  width: 100%;
}

.foxycape-pdf-mark-list__search-icon {
  display: inline-flex;
  color: var(--text-muted);
}

.foxycape-pdf-mark-list__clear {
  flex: 0 0 auto;
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
