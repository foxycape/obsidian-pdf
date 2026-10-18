<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, X } from '@lucide/vue'
import { loadReplyLanguage, saveReplyLanguage } from '../prefs'
import { loadEdgeLanguages, type ListedLanguage } from '../translate/edgeLanguages'

defineProps<{
  t: (key: string, fallback: string) => string
}>()

const emit = defineEmits<{
  close: []
}>()

const search = ref('')
const current = ref('')
const languages = ref<ListedLanguage[]>([])

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) {
    return languages.value
  }
  return languages.value.filter((item) => {
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.nativeTitle.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword)
    )
  })
})

const choose = async (code: string) => {
  await saveReplyLanguage(code)
  emit('close')
}

onMounted(async () => {
  const [items, selected] = await Promise.all([loadEdgeLanguages(), loadReplyLanguage()])
  languages.value = items
  current.value = selected.code
})
</script>

<template>
  <div class="fpdf-dialog fpdf-dialog--languages" @pointerdown.stop>
    <header class="fpdf-dialog__bar">
      <div class="fpdf-dialog__title">{{ t('ai_reply_language', 'Reply language') }}</div>
      <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_close', 'Close')" @click="emit('close')">
        <X class="fpdf-icon" />
      </button>
    </header>
    <label class="fpdf-search">
      <Search class="fpdf-icon fpdf-icon--sm" />
      <input v-model="search" type="search" :placeholder="t('ai_language_search', 'Search languages')" />
    </label>
    <div class="fpdf-lang-list">
      <button
        v-for="lang in filtered"
        :key="lang.code"
        type="button"
        class="clickable-icon fpdf-lang-row"
        :class="{ 'is-active': lang.code === current }"
        @click="choose(lang.code)"
      >
        <span class="fpdf-lang-row__title">{{ lang.title || lang.code }}</span>
        <span v-if="lang.nativeTitle && lang.nativeTitle !== lang.title" class="fpdf-lang-row__native">
          {{ lang.nativeTitle }}
        </span>
      </button>
    </div>
  </div>
</template>
