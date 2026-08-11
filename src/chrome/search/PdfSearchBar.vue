<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import { debounce, EventNames } from '@foxycape/core/kernal'
import type {
  IPdfSearcher,
  PdfSearchMatch,
  PdfSearchMatchOptions,
  PdfSearchResult,
} from '@/search'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import ObsidianIcon from '@/ui/ObsidianIcon.vue'
import PdfSearchOptions from './PdfSearchOptions.vue'
import PdfSearchResultList from './PdfSearchResultList.vue'

const SEARCH_DEBOUNCE_MS = 500

const props = defineProps<{
  reader: Reader
  searcher: IPdfSearcher
  open: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const keyword = ref('')
const searchedKeyword = ref('')
const searching = ref(false)
const displayResults = ref(false)
const displayOptions = ref(false)
const options = reactive<PdfSearchMatchOptions>({
  caseSensitive: false,
  matchDiacritics: false,
  entireWord: false,
})
const searchResult = reactive<PdfSearchResult>({
  keyword: '',
  finished: true,
  total: 0,
  index: -1,
  items: [],
})

const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<{ scrollIntoCurrentSearchItem?: () => void } | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const counterText = computed(() => {
  if (!searchResult.total) {
    return ''
  }
  const current = searchResult.index >= 0 ? searchResult.index + 1 : 1
  return `${current}/${searchResult.total}${searchResult.finished ? '' : '+'}`
})

const hasNoResults = computed(
  () =>
    !!searchedKeyword.value &&
    !searching.value &&
    searchResult.finished &&
    searchResult.total === 0,
)

const showClearButton = computed(
  () => !searching.value && keyword.value.length > 0,
)

const syncResult = (result: PdfSearchResult) => {
  searchResult.keyword = result.keyword
  searchResult.finished = result.finished
  searchResult.total = result.total
  searchResult.index = result.index
  searchResult.items = result.items
}

const focusInput = async () => {
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

const clearSearch = async () => {
  searchedKeyword.value = ''
  await props.searcher.removeAll(true)
  syncResult(props.searcher.getResult())
}

const close = async () => {
  displayOptions.value = false
  displayResults.value = false
  emit('update:open', false)
  keyword.value = ''
  await clearSearch()
}

const clearInput = async () => {
  keyword.value = ''
  await clearSearch()
  await focusInput()
}

const doSearch = async () => {
  const query = keyword.value.trim()
  if (!query) {
    await clearSearch()
    return
  }
  if (query === searchedKeyword.value && searchResult.total > 0 && searchResult.finished) {
    return
  }
  searching.value = true
  displayOptions.value = false
  try {
    const result = await props.searcher.search({
      query,
      caseSensitive: options.caseSensitive,
      matchDiacritics: options.matchDiacritics,
      entireWord: options.entireWord,
    })
    // Keep index at -1: paint all hits, but do not jump to the first match.
    syncResult(result)
    searchedKeyword.value = query
  } finally {
    searching.value = false
  }
}

/** Debounced auto-search while typing (resets on each keystroke). */
const scheduleSearch = debounce(() => {
  if (!props.open) {
    return
  }
  void doSearch()
}, SEARCH_DEBOUNCE_MS)

const onOptionsChange = (patch: Partial<PdfSearchMatchOptions>) => {
  Object.assign(options, patch)
  props.searcher.setOptions(options)
  searchedKeyword.value = ''
  scheduleSearch()
}

const toggleCaseSensitive = () => {
  onOptionsChange({ caseSensitive: !options.caseSensitive })
}

const gotoSearchResult = async (item: PdfSearchMatch) => {
  await props.searcher.goto(item)
  syncResult(props.searcher.getResult())
}

const gotoPrevious = async () => {
  await props.searcher.gotoPrevious()
  syncResult(props.searcher.getResult())
}

const gotoNext = async () => {
  await props.searcher.gotoNext()
  syncResult(props.searcher.getResult())
}

const onKeyup = async (evt: KeyboardEvent) => {
  if (evt.key === 'Escape') {
    evt.preventDefault()
    await close()
    return
  }
  if (evt.key !== 'Enter') {
    return
  }
  const query = keyword.value.trim()
  if (query && query === searchedKeyword.value && searchResult.total > 0) {
    await gotoNext()
    return
  }
  await doSearch()
}

const onDocumentKeydown = (evt: KeyboardEvent) => {
  if (!props.open) {
    return
  }
  if (evt.key === 'Escape') {
    evt.preventDefault()
    void close()
  }
}

const onRequestOpenFind = () => {
  if (props.open) {
    void close()
    return
  }
  emit('update:open', true)
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      Object.assign(options, props.searcher.getOptions())
      await focusInput()
      return
    }
    keyword.value = ''
    await clearSearch()
  },
)

watch(keyword, (value) => {
  if (!props.open) {
    return
  }
  if (!value.trim()) {
    void clearSearch()
    return
  }
  scheduleSearch()
})

onMounted(() => {
  props.reader.events.on(EventNames.RequestOpenFind, onRequestOpenFind)
  window.addEventListener('keydown', onDocumentKeydown, true)
})

onBeforeUnmount(() => {
  props.reader.events.off(EventNames.RequestOpenFind, onRequestOpenFind)
  window.removeEventListener('keydown', onDocumentKeydown, true)
  void props.searcher.removeAll(true)
})
</script>

<template>
  <div v-show="open" ref="rootRef" class="foxycape-pdf-search-bar" @keydown.stop>
    <div class="foxycape-pdf-search-bar__row">
      <div class="foxycape-pdf-search-bar__input-container" :class="{ 'is-empty': hasNoResults }">
        <span class="foxycape-pdf-search-bar__search-icon" aria-hidden="true">
          <ObsidianIcon icon="search" />
        </span>
        <input ref="inputRef" v-model="keyword" class="foxycape-pdf-search-bar__input" type="search"
          enterkeyhint="search" spellcheck="false" maxlength="100"
          :placeholder="t('pdf_search_placeholder', 'Find in document')"
          :aria-label="t('pdf_search_placeholder', 'Find in document')" :aria-invalid="hasNoResults || undefined"
          @keyup="onKeyup" />
        <div class="foxycape-pdf-search-bar__actions">
          <ClickableIconButton icon="uppercase-lowercase-a" :class-name="[
            'foxycape-pdf-search-bar__decorator',
            { 'is-active': options.caseSensitive },
          ]" :label="t('pdf_search_case_sensitive', 'Match case')" :aria-pressed="options.caseSensitive"
            @click="toggleCaseSensitive" />
        
          <button v-if="searching" ref="el" type="button" class="clickable-icon"
            :aria-label="t('pdf_search_searching', 'Searching')" >
            <div class="foxycape-pdf-search-bar__spinner" role="status" />
          </button>
          <ClickableIconButton v-else-if="showClearButton" icon="x" :label="t('pdf_search_clear', 'Clear search')"
            @click="clearInput" />
        </div>
      </div>

      <span v-if="counterText" class="foxycape-pdf-search-bar__counter">{{
        counterText
      }}</span>
      <ClickableIconButton icon="arrow-up" class-name="foxycape-pdf-search-bar__btn"
        :label="t('pdf_search_previous', 'Previous result')" :disabled="searchResult.total <= 0"
        @click="gotoPrevious" />
      <ClickableIconButton icon="arrow-down" class-name="foxycape-pdf-search-bar__btn"
        :label="t('pdf_search_next', 'Next result')" :disabled="searchResult.total <= 0" @click="gotoNext" />
      <ClickableIconButton icon="list" :class-name="[
        'foxycape-pdf-search-bar__btn',
        { 'is-active': displayResults },
      ]" :label="t('pdf_search_results', 'Results')" :disabled="searchResult.total <= 0 && !searchedKeyword"
        @click="displayResults = !displayResults" />
      <PdfSearchOptions v-model:open="displayOptions" :options="options" :t="t" @change="onOptionsChange" />
      <ClickableIconButton icon="x" class-name="foxycape-pdf-search-bar__btn" :label="t('pdf_search_close', 'Close')"
        @click="close" />
    </div>

    <PdfSearchResultList v-if="displayResults" ref="listRef" :result="searchResult" :searcher="searcher" :t="t"
      :goto-search-result="gotoSearchResult" />
  </div>
</template>
