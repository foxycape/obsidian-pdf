<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownContent from '@/ai/ui/MarkdownContent.vue'
import { toFormulaMarkdown } from '@/ocr/formulaMarkdown'
import { sanitizeTableHtml } from '@/ocr/tableHtml'
import type { OcrSheetFrame } from '@/screenshot/placeBesideSelection'
import type { OcrSheetState } from '@/ocr/types'
import { useApplyIcon } from '@/ui/applyIcon'

const props = defineProps<{
  result: OcrSheetState
  frame: OcrSheetFrame
  busy: boolean
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  copy: []
  review: []
  close: []
}>()

const closeEl = ref<HTMLButtonElement | null>(null)
const helpEl = ref<HTMLButtonElement | null>(null)
const tipRoot = ref<HTMLElement | null>(null)
const spinEl = ref<HTMLElement | null>(null)
const tipOpen = ref(false)

useApplyIcon(closeEl, () => 'x')
useApplyIcon(helpEl, () => 'help-circle')
useApplyIcon(spinEl, () => 'loader-2')

const title = computed(() => {
  if (props.result.kind === 'equation') {
    return props.t('pdf_ocr_result_equation', 'Equation')
  }
  if (props.result.kind === 'table') {
    return props.t('pdf_ocr_result_table', 'Table')
  }
  return props.t('pdf_ocr_result_text', 'Text')
})

const formula = computed(() =>
  props.result.kind === 'equation' ? toFormulaMarkdown(props.result.content) : '',
)

const cardStyle = computed(() => ({
  left: props.frame.left == null ? 'auto' : `${props.frame.left}px`,
  top: props.frame.top == null ? 'auto' : `${props.frame.top}px`,
  bottom: props.frame.bottom == null ? 'auto' : `${props.frame.bottom}px`,
  width: `${props.frame.maxWidth}px`,
  maxHeight: `${props.frame.maxHeight}px`,
}))

const tableHtml = computed(() =>
  props.result.kind === 'table' ? sanitizeTableHtml(props.result.content) : '',
)

const reviewTip = computed(() =>
  props.t(
    'pdf_ocr_review_tip',
    'Proofreading uses more tokens, but accuracy can exceed 99%. Skip it when the result has no obvious errors.',
  ),
)

const toggleTip = () => {
  if (props.busy) {
    return
  }
  tipOpen.value = !tipOpen.value
}

const onPointerDown = (event: PointerEvent) => {
  if (!tipOpen.value) {
    return
  }
  const target = event.target
  if (target instanceof Node && tipRoot.value?.contains(target)) {
    return
  }
  tipOpen.value = false
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || props.busy) {
    return
  }
  if (tipOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    tipOpen.value = false
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

watch(
  () => props.busy,
  (busy) => {
    if (busy) {
      tipOpen.value = false
    }
  },
)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown, true)
  document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <div class="foxycape-pdf-ocr-sheet">
    <section
      class="foxycape-pdf-ocr-sheet__card"
      :style="cardStyle"
      role="dialog"
      tabindex="-1"
    >
      <header class="foxycape-pdf-ocr-sheet__header">
        <h3>{{ title }}</h3>
        <button
          ref="closeEl"
          type="button"
          class="clickable-icon foxycape-pdf-ocr-sheet__close"
          :disabled="busy"
          @click="emit('close')"
        />
      </header>
      <div class="foxycape-pdf-ocr-sheet__body">
        <p v-if="result.kind === 'text'" class="foxycape-pdf-ocr-sheet__text">{{ result.content }}</p>
        <template v-else-if="result.kind === 'equation'">
          <MarkdownContent :content="formula" />
          <details class="foxycape-pdf-ocr-sheet__source">
            <summary>{{ t('pdf_ocr_source', 'Source') }}</summary>
            <pre>{{ result.content }}</pre>
          </details>
        </template>
        <div v-else-if="tableHtml" class="foxycape-pdf-ocr-sheet__table" v-html="tableHtml" />
        <pre v-else class="foxycape-pdf-ocr-sheet__text">{{ result.content }}</pre>
      </div>
      <footer class="foxycape-pdf-ocr-sheet__actions">
        <div v-if="result.reviewNote && !busy" class="foxycape-pdf-ocr-sheet__verdict">
          <span>{{ t('pdf_ocr_review_done', 'Proofread complete') }}</span>
          <span v-if="!result.reviewNote.ok" class="foxycape-pdf-ocr-sheet__error">
            {{ result.reviewNote.explanation }}
          </span>
        </div>
        <div class="foxycape-pdf-ocr-sheet__buttons">
          <div ref="tipRoot" class="foxycape-pdf-ocr-sheet__help">
            <button
              ref="helpEl"
              type="button"
              class="clickable-icon foxycape-pdf-ocr-sheet__help-btn"
              :disabled="busy"
              :aria-expanded="tipOpen"
              :aria-label="t('pdf_ocr_review', 'Proofread')"
              @click.stop="toggleTip"
            />
            <div v-if="tipOpen" class="foxycape-pdf-ocr-sheet__tip" role="note">
              {{ reviewTip }}
            </div>
          </div>
          <button type="button" class="foxycape-pdf-ocr-sheet__review" :disabled="busy" @click="emit('review')">
            <span v-if="busy" ref="spinEl" class="foxycape-pdf-ocr-sheet__spin" />
            {{ t('pdf_ocr_review', 'Proofread') }}
          </button>
          <button type="button" class="mod-cta" :disabled="busy" @click="emit('copy')">
            {{ t('pdf_ocr_copy', 'Copy') }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
