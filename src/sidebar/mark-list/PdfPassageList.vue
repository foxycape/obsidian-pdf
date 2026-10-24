<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { readAppLanguage } from '@/i18n/readAppLanguage'
import type { Reader } from '@foxycape/core/kernal'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import { buildMark, getFixedContentRange, type IMarker } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import { deletePassage, listExplainMarks, listLookupMarks, listTranslateMarks, patchPassageNav } from '@/ai/passage/stores'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import { resolvePdfNavMeta } from '@/marker/pdfNavMeta'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import ClampText from './ClampText.vue'
import { formatDisplayDate } from './formatDisplayDate'
import PdfListToolbar from './PdfListToolbar.vue'
import { groupNavItems, type MarkSortMode } from './markListGroup'

const props = defineProps<{
  kind: 'translate' | 'explain' | 'lookup'
  reader: Reader
  storage: DexieStorage
  getMarker: () => IMarker | undefined
  active: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}>()

const emit = defineEmits<{
  navigated: []
}>()

type Row = {
  markId: string
  text: string
  body: string
  searchText: string
  pageNumber?: number
  simpleId: string
  updatedAt: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
}

const rows = ref<Row[]>([])
const keyword = ref('')
const sortMode = ref<MarkSortMode>('progress')
const toolbarRef = ref<{ closeMenus: () => void } | null>(null)

const sortOptions = computed(() => [
  { mode: 'progress' as const, label: props.t('pdf_mark_list_sort_progress', 'Default · in document') },
  { mode: 'updateDesc' as const, label: props.t('pdf_mark_list_sort_update_desc', 'Updated · descending') },
  { mode: 'updateAsc' as const, label: props.t('pdf_mark_list_sort_update_asc', 'Updated · ascending') },
])

const filteredRows = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  if (!needle) {
    return rows.value
  }
  return rows.value.filter((row) => row.searchText.toLowerCase().includes(needle))
})

const groups = computed(() =>
  groupNavItems(filteredRows.value, sortMode.value, props.t('pdf_mark_list_ungrouped', 'Ungrouped')),
)

const copy = computed(() => {
  const count = rows.value.length
  if (props.kind === 'translate') {
    return {
      tab: props.t('ai_marks_tab_translate', 'Translate'),
      search: props.t('pdf_passage_search_translate', 'Filter translations'),
      hint: props.t('pdf_passage_search_translate_hint', 'Filter {count} translations', { count }),
      empty: props.t('pdf_passage_empty_translate', 'No translations'),
      filterEmpty: props.t('pdf_passage_filter_empty_translate', 'No translations match the filters'),
    }
  }
  if (props.kind === 'explain') {
    return {
      tab: props.t('ai_marks_tab_explain', 'Explain'),
      search: props.t('pdf_passage_search_explain', 'Filter explanations'),
      hint: props.t('pdf_passage_search_explain_hint', 'Filter {count} explanations', { count }),
      empty: props.t('pdf_passage_empty_explain', 'No explanations'),
      filterEmpty: props.t('pdf_passage_filter_empty_explain', 'No explanations match the filters'),
    }
  }
  return {
    tab: props.t('ai_marks_tab_lookup', 'Look up'),
    search: props.t('pdf_passage_search_lookup', 'Filter lookups'),
    hint: props.t('pdf_passage_search_lookup_hint', 'Filter {count} lookups', { count }),
    empty: props.t('pdf_passage_empty_lookup', 'No lookups'),
    filterEmpty: props.t('pdf_passage_filter_empty_lookup', 'No lookups match the filters'),
  }
})

const stickyTitle = ref('')
const listRoot = ref<HTMLElement | null>(null)

const syncStickyTitle = () => {
  const scroller = listRoot.value
  if (!scroller || groups.value.length === 0) {
    stickyTitle.value = ''
    return
  }
  const headers = Array.from(scroller.querySelectorAll<HTMLElement>('[data-passage-group]'))
  const top = scroller.getBoundingClientRect().top
  let current = ''
  for (const header of headers) {
    if (header.getBoundingClientRect().top <= top + 1) {
      current = header.dataset.passageGroup ?? ''
    }
  }
  stickyTitle.value = current
}

watch(groups, async () => {
  stickyTitle.value = ''
  await nextTick()
  syncStickyTitle()
})

const fillNav = async (items: Row[], table: 'translates' | 'explains' | 'lookups') => {
  const renderer = getPdfRenderer(props.reader)
  for (const item of items) {
    if (item.navTitle || item.navUrl || !item.pageNumber) {
      continue
    }
    const nav = await resolvePdfNavMeta(renderer, item.pageNumber)
    if (!nav) {
      continue
    }
    item.navTitle = nav.navTitle
    item.navUrl = nav.navUrl
    await patchPassageNav(props.storage, table, item.markId, nav)
  }
}

const load = async () => {
  const simpleId = props.reader.context?.id ?? ''
  if (!simpleId) {
    rows.value = []
    return
  }
  if (props.kind === 'translate') {
    const marks = await listTranslateMarks(props.storage, simpleId)
    const next = marks.map((mark) => ({
      markId: mark.markId,
      text: mark.text,
      body: mark.results[0]?.translatedText ?? '',
      searchText: [mark.text, ...mark.results.map((item) => item.translatedText)].join('\n'),
      pageNumber: mark.pageNumber,
      simpleId: mark.simpleId,
      updatedAt: mark.updatedAt,
      navUrl: mark.navUrl,
      navTitle: mark.navTitle,
      contentRange: mark.contentRange,
    }))
    await fillNav(next, 'translates')
    rows.value = next
    return
  }
  if (props.kind === 'explain') {
    const marks = await listExplainMarks(props.storage, simpleId)
    const next = marks.map((mark) => ({
      markId: mark.markId,
      text: mark.text,
      body: mark.results[0]?.explanation ?? '',
      searchText: [mark.text, ...mark.results.map((item) => item.explanation)].join('\n'),
      pageNumber: mark.pageNumber,
      simpleId: mark.simpleId,
      updatedAt: mark.updatedAt,
      navUrl: mark.navUrl,
      navTitle: mark.navTitle,
      contentRange: mark.contentRange,
    }))
    await fillNav(next, 'explains')
    rows.value = next
    return
  }
  const marks = await listLookupMarks(props.storage, simpleId)
  const next = marks.map((mark) => ({
    markId: mark.markId,
    text: mark.text,
    body: mark.results[0]?.lookup ?? '',
    searchText: [mark.text, ...mark.results.map((item) => item.lookup)].join('\n'),
    pageNumber: mark.pageNumber,
    simpleId: mark.simpleId,
    updatedAt: mark.updatedAt,
    navUrl: mark.navUrl,
    navTitle: mark.navTitle,
    contentRange: mark.contentRange,
  }))
  await fillNav(next, 'lookups')
  rows.value = next
}

type MetaPart = { text: string; title?: string }

const metaParts = (row: Row): MetaPart[] => {
  const parts: MetaPart[] = []
  if (row.pageNumber) {
    parts.push({ text: props.t('ai_page_label', 'Page {page}', { page: row.pageNumber }) })
  }
  if (row.updatedAt) {
    const display = formatDisplayDate(row.updatedAt, {
      locale: readAppLanguage(),
      todayLabel: props.t('pdf_date_today', 'Today'),
      yesterdayLabel: props.t('pdf_date_yesterday', 'Yesterday'),
    })
    if (display.label) {
      parts.push({ text: display.label, title: display.title })
    }
  }
  return parts
}

const metaText = computed(() => rows.value.map((row) => ({ id: row.markId, parts: metaParts(row) })))

const metaOf = (markId: string) => metaText.value.find((item) => item.id === markId)?.parts ?? []

const gotoRow = async (row: Row) => {
  const marker = props.getMarker()
  const existing = await marker?.getMark(row.markId)
  const existingRange = existing ? getFixedContentRange(existing) : undefined
  if (existing && existingRange?.geometries.length) {
    await marker?.goto(existing)
  } else if (row.contentRange?.geometries.length) {
    await marker?.goto(
      buildMark(row.simpleId, 'drawline', row.text, 'mark_pen', row.contentRange, row.markId),
    )
  } else if (row.pageNumber) {
    const mark = buildMark(row.simpleId, 'drawline', row.text, 'mark_pen', {
      kind: 'fixed',
      geometries: [],
    }, row.markId)
    mark.pageNumber = row.pageNumber
    await marker?.goto(mark)
  }
  emit('navigated')
}

const removeRow = async (row: Row) => {
  const table = props.kind === 'translate' ? 'translates' : props.kind === 'explain' ? 'explains' : 'lookups'
  await deletePassage(props.storage, table, row.markId)
  await load()
}

watch(
  () => [props.active, props.reader, props.kind] as const,
  ([active]) => {
    if (active) {
      void load()
      return
    }
    toolbarRef.value?.closeMenus()
  },
)

onMounted(async () => {
  if (props.active) {
    await load()
  }
})
</script>

<template>
  <div class="foxycape-pdf-passage-list">
    <PdfListToolbar
      v-if="rows.length > 0"
      ref="toolbarRef"
      show-search
      :count="filteredRows.length"
      :count-label="copy.tab"
      :sort-mode="sortMode"
      :sort-options="sortOptions"
      :sort-label="t('pdf_mark_list_sort', 'Sort')"
      :search-label="copy.search"
      :search-placeholder="copy.hint"
      :keyword="keyword"
      @update:sort-mode="sortMode = $event"
      @update:keyword="keyword = $event"
    />
    <div class="foxycape-pdf-passage-list__main">
    <h3 v-if="stickyTitle" class="foxycape-pdf-passage-list__group foxycape-pdf-passage-list__sticky">{{ stickyTitle }}</h3>
    <div ref="listRoot" class="foxycape-pdf-passage-list__scroller" @scroll.passive="syncStickyTitle">
      <p v-if="rows.length === 0" class="foxycape-pdf-passage-list__empty">
        {{ copy.empty }}
      </p>
      <p v-else-if="filteredRows.length === 0" class="foxycape-pdf-passage-list__empty">
        {{ copy.filterEmpty }}
      </p>
      <template v-for="(group, groupIndex) in groups" :key="group.key || 'all'">
        <h3
          v-if="group.title"
          class="foxycape-pdf-passage-list__group"
          :class="{ 'is-follow': groupIndex > 0 }"
          :data-passage-group="group.title"
        >{{ group.title }}</h3>
      <article
        v-for="(row, index) in group.items"
        :key="row.markId"
        class="foxycape-pdf-passage-list__item"
        :class="{ 'is-last': index === group.items.length - 1 }"
      >
      <div class="foxycape-pdf-passage-list__source" role="button" tabindex="0" @click="gotoRow(row)" @keydown.enter="gotoRow(row)">
        <ClampText :text="row.text" :lines="2" />
      </div>
      <ClampText v-if="row.body" class="foxycape-pdf-passage-list__body" :text="row.body" :lines="3" />
      <div class="foxycape-pdf-passage-list__foot">
        <div class="foxycape-pdf-passage-list__meta">
          <template v-for="(part, partIndex) in metaOf(row.markId)" :key="`${row.markId}-${partIndex}`">
            <span v-if="partIndex > 0" class="foxycape-pdf-passage-list__dot">·</span>
            <span :title="part.title">{{ part.text }}</span>
          </template>
        </div>
        <ClickableIconButton
          icon="trash-2"
          class-name="foxycape-pdf-passage-list__delete"
          :label="t('share_delete', 'Delete')"
          @click.stop="removeRow(row)"
        />
      </div>
      </article>
      </template>
    </div>
    </div>
  </div>
</template>

<style scoped>
.foxycape-pdf-passage-list {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.foxycape-pdf-passage-list__main {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.foxycape-pdf-passage-list__scroller {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.foxycape-pdf-passage-list__group {
  margin: 0;
  padding: 6px 12px;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-weight: 400;
}

.foxycape-pdf-passage-list__group.is-follow {
  padding-top: 18px;
}

.foxycape-pdf-passage-list__sticky {
  position: absolute;
  inset-inline: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  background: var(--background-secondary);
}

.foxycape-pdf-passage-list__item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
}

.foxycape-pdf-passage-list__item:not(.is-last)::after {
  content: '';
  position: absolute;
  inset-inline: 12px;
  bottom: 0;
  height: 1px;
  background: var(--background-modifier-border);
}

.foxycape-pdf-passage-list__source {
  width: fit-content;
  max-width: 100%;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  text-align: start;
  cursor: pointer;
}

.foxycape-pdf-passage-list__body {
  color: var(--text-normal);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.55;
}

.foxycape-pdf-passage-list__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.foxycape-pdf-passage-list__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 16px;
}

.foxycape-pdf-passage-list__dot {
  opacity: 0.7;
}

.foxycape-pdf-passage-list__delete {
  flex: 0 0 auto;
  color: var(--text-muted);
  opacity: 0.55;
}

.foxycape-pdf-passage-list__item:hover .foxycape-pdf-passage-list__delete {
  opacity: 1;
}

.foxycape-pdf-passage-list__empty {
  margin: 0;
  padding: 12px;
  color: var(--text-muted);
}
</style>
