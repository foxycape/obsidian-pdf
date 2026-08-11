<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PdfSearchMatchOptions } from '@/search'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'

const props = defineProps<{
  open: boolean
  options: PdfSearchMatchOptions
  t: (key: string, fallback: string) => string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  change: [patch: Partial<PdfSearchMatchOptions>]
}>()

const triggerBtn = ref<{ el?: HTMLButtonElement | null } | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const getTriggerEl = () => triggerBtn.value?.el ?? null

const toggle = (key: keyof PdfSearchMatchOptions) => {
  emit('change', { [key]: !props.options[key] })
}

const toggleOpen = () => {
  emit('update:open', !props.open)
}

const positionPanel = () => {
  const trigger = getTriggerEl()
  if (!trigger) {
    return
  }
  const rect = trigger.getBoundingClientRect()
  const gap = 6
  const width = 180
  let left = rect.right - width
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  let top = rect.bottom + gap
  panelStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
    zIndex: 'var(--layer-menu, 40)',
  }
  void nextTick(() => {
    const panel = panelRef.value
    if (!panel) {
      return
    }
    const panelRect = panel.getBoundingClientRect()
    if (panelRect.bottom > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelRect.height - gap)
      panelStyle.value = {
        ...panelStyle.value,
        top: `${top}px`,
      }
    }
  })
}

const onDocClick = (evt: MouseEvent) => {
  if (!props.open) {
    return
  }
  const target = evt.target as Node | null
  if (!target) {
    return
  }
  if (getTriggerEl()?.contains(target) || panelRef.value?.contains(target)) {
    return
  }
  emit('update:open', false)
}

const onKeydown = (evt: KeyboardEvent) => {
  if (!props.open) {
    return
  }
  if (evt.key === 'Escape') {
    evt.preventDefault()
    evt.stopPropagation()
    emit('update:open', false)
  }
}

watch(
  () => props.open,
  (value) => {
    if (value) {
      void nextTick().then(positionPanel)
    }
  },
)

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', positionPanel)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', positionPanel)
})
</script>

<template>
  <div class="foxycape-pdf-search-options-wrap">
    <ClickableIconButton
      ref="triggerBtn"
      icon="sliders-horizontal"
      :class-name="['foxycape-pdf-search-bar__btn', { 'is-active': open }]"
      :label="t('pdf_search_options', 'Options')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click.stop="toggleOpen"
    />
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="foxycape-pdf-search-options-panel"
        role="dialog"
        :aria-label="t('pdf_search_options', 'Options')"
        :style="panelStyle"
        @mousedown.stop
        @click.stop
      >
        <div class="foxycape-pdf-search-options__row">
          <span class="foxycape-pdf-search-options__label">
            {{ t('pdf_search_diacritics', 'Match diacritics') }}
          </span>
          <div
            class="checkbox-container"
            :class="{ 'is-enabled': options.matchDiacritics }"
            role="switch"
            :aria-checked="options.matchDiacritics"
            tabindex="0"
            @click="toggle('matchDiacritics')"
            @keydown.enter.prevent="toggle('matchDiacritics')"
            @keydown.space.prevent="toggle('matchDiacritics')"
          />
        </div>
        <div class="foxycape-pdf-search-options__row">
          <span class="foxycape-pdf-search-options__label">
            {{ t('pdf_search_entire_word', 'Whole words') }}
          </span>
          <div
            class="checkbox-container"
            :class="{ 'is-enabled': options.entireWord }"
            role="switch"
            :aria-checked="options.entireWord"
            tabindex="0"
            @click="toggle('entireWord')"
            @keydown.enter.prevent="toggle('entireWord')"
            @keydown.space.prevent="toggle('entireWord')"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
