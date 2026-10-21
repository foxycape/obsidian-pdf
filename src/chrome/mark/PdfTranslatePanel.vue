<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronsUpDown, Copy, Languages, Search, Settings } from '@lucide/vue'
import { Notice } from 'obsidian'
import type { IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import type { DexieStorage } from '@/storage/DexieStorage'
import { resolveAiAccessChoice, type AiAccessMode } from '@/ai/accessChoice'
import { AiAccessError } from '@/ai/errors'
import { countTranslates, findTranslateText, upsertTranslate } from '@/ai/passage/stores'
import type { TranslateEngine } from '@/ai/passage/types'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import {
  loadTranslatePrefs,
  saveTranslatePrefs,
  type TranslatePrefs,
} from '@/ai/prefs'
import { findListedLanguage, loadEdgeLanguages, type ListedLanguage } from '@/ai/translate/edgeLanguages'
import { translateSelection } from '@/ai/translate/translateSelection'
import { getAiRuntime } from '@/ai/runtime'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import { onInuseModelChange } from '@/ai/llm/inuseModelChange'
import { resolveInuseModelLabel } from '@/ai/llm/inuseModelLabel'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'

const props = defineProps<{
  sourceText: string
  markId: string
  simpleId: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  storage: DexieStorage
  httpClient: IHttpClient
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  back: []
  openModel: []
  needAccess: [mode: AiAccessMode]
  openList: []
  quota: []
}>()

const view = ref<'main' | 'language'>('main')
const engineOpen = ref(false)
const settingsOpen = ref(false)
const qualityOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const prefs = ref<TranslatePrefs>({ engine: 'edgemt', language: 'en', quality: 'low' })
const translatedText = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const translateCount = ref(0)
const modelLabel = ref('')
const search = ref('')
const languages = ref<ListedLanguage[]>([])
let requestSeq = 0

useHistoryLayer(
  () => view.value === 'language',
  () => {
    view.value = 'main'
  },
)
useHistoryLayer(engineOpen, () => {
  engineOpen.value = false
})
useHistoryLayer(settingsOpen, () => {
  settingsOpen.value = false
  qualityOpen.value = false
})
useHistoryLayer(qualityOpen, () => {
  qualityOpen.value = false
})

useDismissOnOutside(
  () => engineOpen.value || settingsOpen.value || qualityOpen.value,
  () => [menuRoot.value],
  () => {
    engineOpen.value = false
    settingsOpen.value = false
    qualityOpen.value = false
  },
)

const engineLabel = computed(() =>
  prefs.value.engine === 'ai'
    ? props.t('ai_translate_ai', 'AI')
    : props.t('ai_translate_microsoft', 'Microsoft'),
)
const languageLabel = computed(() => findListedLanguage(languages.value, prefs.value.language).title)
const qualityLabel = computed(() =>
  prefs.value.quality === 'medium'
    ? props.t('ai_translate_quality', 'Quality first')
    : props.t('ai_translate_speed', 'Speed first'),
)
const filteredLanguages = computed(() => {
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

const refreshModel = async () => {
  if (prefs.value.engine !== 'ai') {
    modelLabel.value = ''
    return
  }
  try {
    modelLabel.value = await resolveInuseModelLabel(props.t)
  } catch {
    modelLabel.value = ''
  }
}

const run = async () => {
  const seq = ++requestSeq
  errorMessage.value = ''
  const cached = await findTranslateText(props.storage, props.markId, prefs.value.engine, prefs.value.language)
  if (seq !== requestSeq) {
    return
  }
  if (cached) {
    translatedText.value = cached
    isLoading.value = false
    return
  }
  if (prefs.value.engine === 'ai') {
    const mode = await resolveAiAccessChoice()
    if (seq !== requestSeq) {
      return
    }
    if (mode) {
      isLoading.value = false
      emit('needAccess', mode)
      return
    }
  }
  isLoading.value = true
  translatedText.value = ''
  try {
    const text = await translateSelection({
      httpClient: props.httpClient,
      text: props.sourceText,
      engine: prefs.value.engine,
      targetLanguage: prefs.value.language,
      quality: prefs.value.engine === 'ai' ? prefs.value.quality : undefined,
    })
    if (seq !== requestSeq) {
      return
    }
    translatedText.value = text
    if (text) {
      await upsertTranslate(props.storage, {
        markId: props.markId,
        simpleId: props.simpleId,
        text: props.sourceText,
        pageNumber: props.pageNumber,
        navUrl: props.navUrl,
        navTitle: props.navTitle,
        contentRange: props.contentRange,
        engine: prefs.value.engine,
        languageCode: prefs.value.language,
        translatedText: text,
      })
      translateCount.value = await countTranslates(props.storage, props.simpleId)
      try {
        await getAiRuntime().writePassageNote?.({
          kind: 'translate',
          markId: props.markId,
          simpleId: props.simpleId,
          text: props.sourceText,
          body: text,
          pageNumber: props.pageNumber,
        })
      } catch (noteError) {
        console.error('[Foxycape PDF] failed to write passage note', noteError)
      }
    }
  } catch (error) {
    if (seq !== requestSeq) {
      return
    }
    if (error instanceof AiAccessError && (error.code === 'no-ai-token' || error.code === 'license-required')) {
      errorMessage.value = ''
      emit('needAccess', error.code === 'no-ai-token' ? 'quota' : 'need-license')
    } else {
      errorMessage.value = error instanceof Error ? error.message : props.t('ai_translate_failed', 'Translation failed')
    }
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
    }
  }
}

const persist = async () => {
  await saveTranslatePrefs(prefs.value)
}

const setEngine = async (engine: TranslateEngine) => {
  engineOpen.value = false
  if (engine === 'ai') {
    const mode = await resolveAiAccessChoice()
    if (mode) {
      emit('needAccess', mode)
      return
    }
  }
  if (prefs.value.engine === engine) {
    return
  }
  prefs.value = { ...prefs.value, engine }
  await persist()
  await refreshModel()
  await run()
}

const setLanguage = async (code: string) => {
  view.value = 'main'
  search.value = ''
  if (prefs.value.language === code) {
    return
  }
  prefs.value = { ...prefs.value, language: code }
  await persist()
  await run()
}

const setQuality = async (quality: 'low' | 'medium') => {
  qualityOpen.value = false
  settingsOpen.value = false
  if (prefs.value.quality === quality) {
    return
  }
  prefs.value = { ...prefs.value, quality }
  await persist()
  if (prefs.value.engine === 'ai') {
    await run()
  }
}

const copyText = async () => {
  if (!translatedText.value) {
    return
  }
  await navigator.clipboard.writeText(translatedText.value)
  new Notice(props.t('share_copy_success_tip', 'Copied to clipboard'))
}

let stopInuseWatch = () => {}

onMounted(async () => {
  stopInuseWatch = onInuseModelChange(() => {
    void refreshModel()
  })
  languages.value = await loadEdgeLanguages()
  prefs.value = await loadTranslatePrefs()
  translateCount.value = await countTranslates(props.storage, props.simpleId)
  await refreshModel()
  await run()
})

onBeforeUnmount(() => {
  stopInuseWatch()
})

watch(
  () => `${props.markId}|${props.sourceText}`,
  () => {
    void run()
  },
)
</script>

<template>
  <div class="fpdf-drill fpdf-drill--translate" :class="{ 'is-open': engineOpen || settingsOpen || qualityOpen }" @pointerdown.stop>
    <template v-if="view === 'language'">
      <header class="fpdf-center-bar">
        <div>
          <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_back', 'Back')" @click="view = 'main'">
            <ChevronLeft class="fpdf-icon" />
          </button>
        </div>
        <div class="fpdf-center-title">{{ t('ai_translate_language', 'Target language') }}</div>
        <div />
      </header>
      <label class="fpdf-search">
        <Search class="fpdf-icon fpdf-icon--sm" />
        <input v-model="search" type="search" :placeholder="t('ai_language_search', 'Search languages')" />
      </label>
      <div class="fpdf-lang-list">
        <button
          v-for="lang in filteredLanguages"
          :key="lang.code"
          type="button"
          class="clickable-icon fpdf-lang-row"
          :class="{ 'is-active': lang.code === prefs.language }"
          @click="setLanguage(lang.code)"
        >
          <span class="fpdf-lang-row__title">{{ lang.title || lang.code }}</span>
          <span v-if="lang.nativeTitle && lang.nativeTitle !== lang.title" class="fpdf-lang-row__native">
            {{ lang.nativeTitle }}
          </span>
        </button>
      </div>
    </template>
    <template v-else>
      <header class="fpdf-translate-bar">
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_back', 'Back')" @click="emit('back')">
          <ChevronLeft class="fpdf-icon" />
        </button>
        <div class="fpdf-translate-main">
          <div ref="menuRoot" class="fpdf-engine">
            <button
              type="button"
              class="clickable-icon fpdf-inline-choice"
              @click.stop="engineOpen = !engineOpen; settingsOpen = false; qualityOpen = false"
            >
              <span>{{ engineLabel }}</span>
              <ChevronsUpDown class="fpdf-icon fpdf-icon--sm" />
            </button>
            <button
              v-if="prefs.engine === 'ai'"
              type="button"
              class="clickable-icon fpdf-icon-btn"
              :aria-label="t('ai_model_settings', 'Model')"
              @click.stop="settingsOpen = !settingsOpen; engineOpen = false; qualityOpen = false"
            >
              <Settings class="fpdf-icon" />
            </button>
            <div v-if="engineOpen" class="fpdf-popover fpdf-popover--start" @pointerdown.stop>
              <button type="button" class="clickable-icon fpdf-menu-item" @click="setEngine('edgemt')">{{ t('ai_translate_microsoft', 'Microsoft') }}</button>
              <button type="button" class="clickable-icon fpdf-menu-item" @click="setEngine('ai')">{{ t('ai_translate_ai', 'AI') }}</button>
            </div>
            <div v-if="settingsOpen" class="fpdf-popover fpdf-popover--start fpdf-popover--wide" @pointerdown.stop>
              <div class="fpdf-menu-row">
                <div class="fpdf-menu-row__label">
                  <div>{{ t('ai_translate_quality_name', 'Translation quality') }}</div>
                  <p class="fpdf-hint">
                    {{
                      prefs.quality === 'medium'
                        ? t('ai_translate_quality_hint', 'Quality first is slower and closer to a professional translation.')
                        : t('ai_translate_speed_hint', 'Speed first is accurate enough for most reading.')
                    }}
                  </p>
                </div>
                <div class="fpdf-center-end">
                  <button type="button" class="clickable-icon fpdf-inline-choice" @click.stop="qualityOpen = !qualityOpen">
                    <span>{{ qualityLabel }}</span>
                    <ChevronsUpDown class="fpdf-icon fpdf-icon--sm" />
                  </button>
                  <div v-if="qualityOpen" class="fpdf-popover fpdf-popover--nested" @pointerdown.stop>
                    <button type="button" class="clickable-icon fpdf-menu-item" @click="setQuality('low')">{{ t('ai_translate_speed', 'Speed first') }}</button>
                    <button type="button" class="clickable-icon fpdf-menu-item" @click="setQuality('medium')">{{ t('ai_translate_quality', 'Quality first') }}</button>
                  </div>
                </div>
              </div>
              <div class="fpdf-rule" />
              <button type="button" class="clickable-icon fpdf-stack-choice" @click="settingsOpen = false; emit('openModel')">
                <span>{{ t('ai_model_settings', 'Model') }}</span>
                <span class="fpdf-muted">{{ modelLabel || t('ai_model_settings', 'Model') }}</span>
              </button>
            </div>
          </div>
          <button type="button" class="clickable-icon fpdf-lang-btn" @click="view = 'language'">
            <Languages class="fpdf-icon fpdf-icon--sm" />
            <span>{{ languageLabel }}</span>
          </button>
        </div>
        <button type="button" class="clickable-icon fpdf-icon-btn" :disabled="!translatedText" :aria-label="t('ai_copy_result', 'Copy')" @click="copyText">
          <Copy class="fpdf-icon" />
        </button>
        <div v-if="isLoading" class="fpdf-progress" role="status" />
      </header>
      <div class="fpdf-drill__body">
        <p v-if="errorMessage" class="fpdf-error">{{ errorMessage }}</p>
        <p v-else-if="translatedText" class="fpdf-result">{{ translatedText }}</p>
        <p v-else class="fpdf-muted">{{ isLoading ? t('ai_translating', 'Translating') : t('ai_translate_empty', 'No translation yet') }}</p>
      </div>
      <footer class="fpdf-drill__foot">
        <button v-if="translateCount > 0" type="button" class="clickable-icon fpdf-text-btn" @click="emit('openList')">
          {{ t('ai_translate_count', 'Already have {count} translations', { count: translateCount }) }}
        </button>
      </footer>
    </template>
  </div>
</template>
