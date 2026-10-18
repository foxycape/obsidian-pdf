<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronsUpDown, LoaderCircle, Settings } from '@lucide/vue'
import type { DexieStorage } from '@/storage/DexieStorage'
import { AiAccessError } from '@/ai/errors'
import { explainPassage } from '@/ai/explain/explainPassage'
import { lookupWord } from '@/ai/lookup/lookupWord'
import { findExplainText, findLookupText } from '@/ai/passage/stores'
import type { ExplainDetail } from '@/ai/passage/types'
import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import { onInuseModelChange } from '@/ai/llm/inuseModelChange'
import { resolveInuseModelLabel } from '@/ai/llm/inuseModelLabel'
import { loadDetailPref, loadReplyLanguage, saveDetailPref } from '@/ai/prefs'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'

const props = defineProps<{
  kind: 'explain' | 'lookup'
  sourceText: string
  markId: string
  simpleId: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  storage: DexieStorage
  active: boolean
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  back: []
  deeper: [prompt: string]
  openModel: []
  openLanguage: []
  quota: []
}>()

const text = ref('')
const isLoading = ref(true)
const detail = ref<ExplainDetail>('brief')
const settingsOpen = ref(false)
const detailOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const modelLabel = ref('')
const languageTitle = ref('')
let requestSeq = 0

useHistoryLayer(settingsOpen, () => {
  settingsOpen.value = false
  detailOpen.value = false
})
useHistoryLayer(detailOpen, () => {
  detailOpen.value = false
})

useDismissOnOutside(
  () => settingsOpen.value || detailOpen.value,
  () => [menuRoot.value],
  () => {
    settingsOpen.value = false
    detailOpen.value = false
  },
)

const title = () =>
  props.kind === 'explain' ? props.t('toolbar_explain', 'Explain this passage') : props.t('toolbar_lookup', 'Look up')

const detailLabel = () =>
  detail.value === 'detailed' ? props.t('ai_explain_detailed', 'Detailed') : props.t('ai_explain_brief', 'Brief')

const refreshLabels = async () => {
  const language = await loadReplyLanguage()
  languageTitle.value = language.title
  try {
    modelLabel.value = await resolveInuseModelLabel(props.t)
  } catch {
    modelLabel.value = ''
  }
  return language.code
}

const run = async () => {
  const seq = ++requestSeq
  isLoading.value = true
  const cached =
    props.kind === 'explain'
      ? await findExplainText(props.storage, props.markId, detail.value)
      : await findLookupText(props.storage, props.markId, detail.value)
  if (seq !== requestSeq) {
    return
  }
  if (cached) {
    text.value = cached
    isLoading.value = false
    return
  }
  try {
    const responseLanguage = await refreshLabels()
    const body =
      props.kind === 'explain'
        ? await explainPassage({
            storage: props.storage,
            markId: props.markId,
            simpleId: props.simpleId,
            text: props.sourceText,
            pageNumber: props.pageNumber,
            navUrl: props.navUrl,
            navTitle: props.navTitle,
            contentRange: props.contentRange,
            responseLanguage,
            detail: detail.value,
          })
        : await lookupWord({
            storage: props.storage,
            markId: props.markId,
            simpleId: props.simpleId,
            text: props.sourceText,
            pageNumber: props.pageNumber,
            navUrl: props.navUrl,
            navTitle: props.navTitle,
            contentRange: props.contentRange,
            responseLanguage,
            detail: detail.value,
          })
    if (seq !== requestSeq) {
      return
    }
    text.value = body || props.t('ai_passage_empty', 'The model returned no content.')
  } catch (error) {
    if (seq !== requestSeq) {
      return
    }
    if (error instanceof AiAccessError && error.code === 'no-ai-token') {
      emit('quota')
    }
    text.value = error instanceof Error ? error.message : props.t('ai_passage_failed', 'Could not finish this request.')
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
    }
  }
}

const setDetail = async (next: ExplainDetail) => {
  detailOpen.value = false
  settingsOpen.value = false
  if (detail.value === next) {
    return
  }
  detail.value = next
  await saveDetailPref(props.kind, next)
  await run()
}

const learnMore = async () => {
  const language = languageTitle.value || (await loadReplyLanguage()).title
  const brief = isLoading.value ? '' : text.value
  const prompt =
    props.kind === 'explain'
      ? [
          'The reader already has a short in-place explanation and wants to go deeper on the same passage.',
          `Write in ${language}.`,
          'Cover background, referents, allusions, and why this passage is hard — enough to keep reading.',
          'Do not spoil later plot. Do not summarize the whole book.',
          brief ? `\n### Short explanation already shown\n${brief}` : '',
          `\n### Passage\n${props.sourceText.trim()}`,
        ].join('\n')
      : [
          'The reader already has a short dictionary gloss and wants a fuller lexical explanation of the same selection.',
          `Write in ${language}.`,
          'Cover senses, grammar, collocations, and why the wording is hard.',
          brief ? `\n### Short gloss already shown\n${brief}` : '',
          `\n### Selection\n${props.sourceText.trim()}`,
        ].join('\n')
  emit('deeper', prompt)
}

let stopInuseWatch = () => {}

onMounted(async () => {
  stopInuseWatch = onInuseModelChange(() => {
    void refreshLabels()
  })
  detail.value = await loadDetailPref(props.kind)
  await refreshLabels()
  if (props.active) {
    await run()
  }
})

onBeforeUnmount(() => {
  stopInuseWatch()
})

watch(
  () => props.active,
  (active) => {
    if (active) {
      void run()
    }
  },
)
</script>

<template>
  <div class="fpdf-drill fpdf-drill--passage" :class="{ 'is-open': settingsOpen || detailOpen }" @pointerdown.stop>
    <header class="fpdf-center-bar">
      <div>
        <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('ai_back', 'Back')" @click="emit('back')">
          <ChevronLeft class="fpdf-icon" />
        </button>
      </div>
      <div class="fpdf-center-title">{{ title() }}</div>
      <div ref="menuRoot" class="fpdf-center-end">
        <button
          type="button"
          class="clickable-icon fpdf-icon-btn"
          :aria-label="t('ai_model_settings', 'Model')"
          @click.stop="settingsOpen = !settingsOpen; detailOpen = false"
        >
          <Settings class="fpdf-icon" />
        </button>
        <div v-if="settingsOpen" class="fpdf-popover fpdf-popover--wide" @pointerdown.stop>
          <div class="fpdf-menu-row">
            <span class="fpdf-menu-row__label">{{ t('ai_detail_label', 'Default detail') }}</span>
            <div class="fpdf-center-end">
              <button type="button" class="clickable-icon fpdf-inline-choice" @click.stop="detailOpen = !detailOpen">
                <span>{{ detailLabel() }}</span>
                <ChevronsUpDown class="fpdf-icon fpdf-icon--sm" />
              </button>
              <div v-if="detailOpen" class="fpdf-popover fpdf-popover--nested" @pointerdown.stop>
                <button type="button" class="clickable-icon fpdf-menu-item" @click="setDetail('brief')">{{ t('ai_explain_brief', 'Brief') }}</button>
                <button type="button" class="clickable-icon fpdf-menu-item" @click="setDetail('detailed')">{{ t('ai_explain_detailed', 'Detailed') }}</button>
              </div>
            </div>
          </div>
          <div class="fpdf-rule" />
          <button type="button" class="clickable-icon fpdf-stack-choice" @click="settingsOpen = false; emit('openModel')">
            <span>{{ t('ai_model_settings', 'Model') }}</span>
            <span class="fpdf-muted">{{ modelLabel || t('ai_model_settings', 'Model') }}</span>
          </button>
          <button type="button" class="clickable-icon fpdf-stack-choice" @click="settingsOpen = false; emit('openLanguage')">
            <span>{{ t('ai_reply_language', 'Reply language') }}</span>
            <span class="fpdf-muted">{{ languageTitle || t('ai_reply_language', 'Reply language') }}</span>
          </button>
        </div>
      </div>
    </header>
    <div class="fpdf-drill__body">
      <p v-if="isLoading" class="fpdf-loading fpdf-muted">
        <LoaderCircle class="fpdf-icon fpdf-spin" />
        {{ t('ai_working', 'Working…') }}
      </p>
      <p v-else class="fpdf-result">{{ text }}</p>
    </div>
    <footer class="fpdf-drill__foot">
      <button type="button" class="clickable-icon mod-cta" :disabled="isLoading" @click="learnMore">{{ t('ai_learn_more', 'Learn more') }}</button>
    </footer>
  </div>
</template>
