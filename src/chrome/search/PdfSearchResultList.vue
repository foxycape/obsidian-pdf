<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { IPdfSearcher, PdfSearchMatch, PdfSearchResult } from '@/search'

const props = defineProps<{
  result: PdfSearchResult
  searcher: IPdfSearcher | null
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  gotoSearchResult: (item: PdfSearchMatch) => Promise<void>
}>()

const scrollerRef = ref<{ scrollToItem?: (index: number) => void } | null>(null)
const showTextMap = ref<Record<string, string>>({})
const pendingIds = new Set<string>()

const ensureItemText = async (item: PdfSearchMatch) => {
  if (!props.searcher || showTextMap.value[item.id] || pendingIds.has(item.id)) {
    return
  }
  if (item.showText) {
    showTextMap.value = { ...showTextMap.value, [item.id]: item.showText }
    return
  }
  pendingIds.add(item.id)
  try {
    const text = await props.searcher.ensureShowText(item)
    if (text) {
      showTextMap.value = { ...showTextMap.value, [item.id]: text }
    }
  } finally {
    pendingIds.delete(item.id)
  }
}

const prefetchVisibleAndNearby = (items: PdfSearchMatch[]) => {
  // Virtual list only mounts a window; still warm snippets for all results in
  // small async batches so scrolling never shows bare ellipses for long.
  const batchSize = 40
  let offset = 0
  const runBatch = () => {
    const slice = items.slice(offset, offset + batchSize)
    if (slice.length === 0) {
      return
    }
    for (const item of slice) {
      void ensureItemText(item)
    }
    offset += batchSize
    if (offset < items.length) {
      window.setTimeout(runBatch, 0)
    }
  }
  runBatch()
}

watch(
  () => props.result.keyword,
  () => {
    showTextMap.value = {}
    pendingIds.clear()
  },
)

watch(
  () => props.result.items,
  (items) => {
    // Keep already-resolved snippets across progressive find updates.
    for (const item of items) {
      if (item.showText && !showTextMap.value[item.id]) {
        showTextMap.value[item.id] = item.showText
      }
    }
    prefetchVisibleAndNearby(items)
  },
  { immediate: true },
)

const scrollIntoCurrentSearchItem = () => {
  const index = props.result.index
  if (index < 0) {
    return
  }
  scrollerRef.value?.scrollToItem?.(index)
  window.setTimeout(() => {
    scrollerRef.value?.scrollToItem?.(index)
  }, 80)
}

defineExpose({ scrollIntoCurrentSearchItem })

watch(
  () => props.result.index,
  async () => {
    await nextTick()
    scrollIntoCurrentSearchItem()
    const active = props.result.items[props.result.index]
    if (active) {
      void ensureItemText(active)
    }
  },
)

const onItemVisible = (item: PdfSearchMatch) => {
  void ensureItemText(item)
}
</script>

<template>
  <div class="foxycape-pdf-search-list">
    <DynamicScroller
      v-if="result.total > 0"
      ref="scrollerRef"
      class="foxycape-pdf-search-list__scroller"
      :items="result.items"
      :min-item-size="54"
      key-field="id"
    >
      <template #before>
        <div class="foxycape-pdf-search-list__header">
          {{
            t('pdf_search_results_count', '{count} results', {
              count: `${result.total}${result.finished ? '' : '+'}`,
            })
          }}
        </div>
      </template>
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
          :min-item-size="1"
          :size-dependencies="[showTextMap[item.id] || '', item.pageNumber]"
          class="foxycape-pdf-search-list__scroller-item"
          @update:active="(isActive: boolean) => isActive && onItemVisible(item)"
        >
          <div
            class="foxycape-pdf-search-list__item"
            :class="{ 'is-active': result.index === index }"
            role="button"
            tabindex="0"
            @click="gotoSearchResult(item)"
            @keydown.enter.prevent="gotoSearchResult(item)"
            @focus="onItemVisible(item)"
            @mouseenter="onItemVisible(item)"
          >
            <span class="foxycape-pdf-search-list__index">{{ index + 1 }}.</span>
            <div class="foxycape-pdf-search-list__body">
              <div
                class="foxycape-pdf-search-list__text"
                v-html="showTextMap[item.id] || '…'"
              />
              <div class="foxycape-pdf-search-list__page">
                {{ t('pdf_search_page', 'Page: {page}', { page: item.pageNumber }) }}
              </div>
            </div>
          </div>
          <hr
            v-if="index < result.total - 1"
            class="foxycape-pdf-search-list__divider"
          />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
    <div v-else class="foxycape-pdf-search-list__empty">
      {{ t('pdf_search_no_results', 'No results') }}
    </div>
  </div>
</template>
