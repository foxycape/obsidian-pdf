<script setup lang="ts">
import { computed } from 'vue'
import { getLanguage } from 'obsidian'
import { cutString } from '@foxycape/core/kernal/common/text'
import type { IMarker, Mark } from '@/mark'
import { DEFAULT_MARK_COLORS } from '@/marker/PdfMarkConstants'
import { getMarkListTextStyle } from '@/marker/PdfMarkStyles'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { formatDisplayDate } from './formatDisplayDate'

/** Preview: hide type icon while testing text styles. */
const showMarkTypeIcon = false

const props = defineProps<{
  mark: Mark
  hideDivider?: boolean
  getMarker: () => IMarker | undefined
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}>()

const emit = defineEmits<{
  deleted: []
  navigated: []
}>()

const displayText = computed(() => cutString(props.mark.text || '', 400, '..'))

const textStyle = computed(() => {
  const styleName = props.mark.styleName
  const color =
    props.mark.customColor ||
    props.getMarker()?.getDefaultColor(props.mark.type, styleName) ||
    DEFAULT_MARK_COLORS[styleName] ||
    DEFAULT_MARK_COLORS.mark_pen
  return getMarkListTextStyle(styleName, color)
})

const displayDate = computed(() =>
  formatDisplayDate(props.mark.updatedAt, {
    locale: getLanguage() || 'en',
    todayLabel: props.t('pdf_date_today', 'Today'),
    yesterdayLabel: props.t('pdf_date_yesterday', 'Yesterday'),
  }),
)

const pageLabel = computed(() => {
  const page = props.mark.pageNumber
  if (page == null) {
    return ''
  }
  return props.t('pdf_mark_list_page', 'Page {page}', { page })
})

const gotoMark = async () => {
  await props.getMarker()?.goto(props.mark)
  emit('navigated')
}

const deleteMark = async () => {
  await props.getMarker()?.deleteMark(props.mark.markId)
  emit('deleted')
}
</script>

<template>
  <div class="foxycape-pdf-mark-item" :class="{ 'is-last': hideDivider }">
    <button
      type="button"
      class="foxycape-pdf-mark-item__text clickable-icon"
      @click="gotoMark"
    >
      <span
        class="foxycape-pdf-mark-item__styled"
        :class="mark.styleName"
        :style="textStyle"
      >{{ displayText }}</span>
    </button>
    <div class="foxycape-pdf-mark-item__meta">
      <div class="foxycape-pdf-mark-item__meta-left">
        <span
          v-if="showMarkTypeIcon"
          class="mark-type-icon"
          aria-hidden="true"
        />
        <span v-if="pageLabel">{{ pageLabel }}</span>
        <span v-if="pageLabel && displayDate.label" class="foxycape-pdf-mark-item__dot">·</span>
        <span v-if="displayDate.label" :title="displayDate.title">{{ displayDate.label }}</span>
      </div>
      <ClickableIconButton
        icon="trash-2"
        class-name="foxycape-pdf-mark-item__delete"
        :label="t('pdf_mark_list_delete', 'Delete')"
        @click.stop="deleteMark"
      />
    </div>
  </div>
</template>

<style scoped>
.foxycape-pdf-mark-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-block: 10px;
  padding-inline: 12px;
}

.foxycape-pdf-mark-item:not(.is-last)::after {
  content: '';
  position: absolute;
  inset-inline: 12px;
  bottom: 0;
  height: 1px;
  background: var(--background-modifier-border);
  pointer-events: none;
}

.foxycape-pdf-mark-item__text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
  width: 100%;
  height: auto;
  min-height: 0;
  max-height: none;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  text-align: start;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  line-height: 1.55;
  cursor: pointer;
  box-shadow: none;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-align: justify;
  border-radius: 0;
}

.foxycape-pdf-mark-item__text:hover {
  color: var(--text-accent);
}

/* Inline + clone so underline / wavy / highlight apply on every wrapped line. */
.foxycape-pdf-mark-item__styled {
  display: inline;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.foxycape-pdf-mark-item__styled.wavy_line,
.foxycape-pdf-mark-item__styled.underline_straight {
  background-color: transparent;
  border: none;
}

.foxycape-pdf-mark-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-inline-start: 4px;
}

.foxycape-pdf-mark-item__meta-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  line-height: 16px;
}

.mark-type-icon {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 5px;
  border-radius: 20px;
  background-color: var(--background-modifier-border);
}

.foxycape-pdf-mark-item__dot {
  opacity: 0.7;
}

.foxycape-pdf-mark-item__delete {
  flex: 0 0 auto;
  opacity: 0.55;
}

.foxycape-pdf-mark-item:hover .foxycape-pdf-mark-item__delete {
  opacity: 1;
}
</style>
