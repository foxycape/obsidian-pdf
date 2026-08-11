<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type {
  PdfScrollMode,
  PdfSpreadMode,
} from '@foxycape/core/mediaTypes/pdf/renderer/layout/IPdfRendererLayout'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import type {
  PdfThemeColorRemapMode,
  PdfViewPreferencePatch,
  PdfViewPreferences,
} from '@/reader/mediaTypes/pdf/CustomPdfOptions'
import { getPdfRenderer } from './usePdfRenderer'

export type { PdfViewPreferences }

const props = defineProps<{
  reader: Reader
  t: (key: string, fallback: string) => string
  /** Bumped by pane-menu / external callers to open the settings panel. */
  openNonce?: number
  getViewPreferences: () => PdfViewPreferences
  onUpdateViewPreferences: (patch: PdfViewPreferencePatch) => Promise<void>
}>()

const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerBtn = ref<{ el?: HTMLButtonElement | null } | null>(null)
const panelStyle = ref<Record<string, string>>({})

const getTriggerEl = () => triggerBtn.value?.el ?? null
const prefs = ref<PdfViewPreferences>(props.getViewPreferences())
const scrollMode = ref<PdfScrollMode>('vertical')
const spreadMode = ref<PdfSpreadMode>('single')

const isSpreadDisabled = computed(() => scrollMode.value === 'horizontal')

const remapModeOptions = computed(() => [
  {
    value: 'both' as const,
    label: props.t('pdf_chrome_settings_theme_scope_all', 'All'),
  },
  {
    value: 'dark' as const,
    label: props.t('pdf_chrome_settings_theme_scope_dark', 'Dark theme'),
  },
  {
    value: 'light' as const,
    label: props.t('pdf_chrome_settings_theme_scope_light', 'Light theme'),
  },
])

const scrollModeOptions = computed(() => [
  {
    value: 'vertical' as const,
    label: props.t('pdf_chrome_settings_scroll_vertical', 'Vertical'),
  },
  {
    value: 'horizontal' as const,
    label: props.t('pdf_chrome_settings_scroll_horizontal', 'Horizontal'),
  },
])

const spreadModeOptions = computed(() => [
  {
    value: 'single' as const,
    label: props.t('pdf_chrome_settings_spread_single', 'Single'),
  },
  {
    value: 'double' as const,
    label: props.t('pdf_chrome_settings_spread_double', 'Facing'),
  },
  {
    value: 'doubleBook' as const,
    label: props.t('pdf_chrome_settings_spread_book', 'Book'),
  },
])

const syncPrefs = () => {
  prefs.value = { ...props.getViewPreferences() }
}

const syncLayout = () => {
  const layout = getPdfRenderer(props.reader)?.layout
  if (!layout) {
    return
  }
  scrollMode.value = layout.scrollMode
  spreadMode.value = layout.spreadMode
}

const syncAll = () => {
  syncPrefs()
  syncLayout()
}

const applyPatch = async (patch: PdfViewPreferencePatch) => {
  prefs.value = {
    ...prefs.value,
    ...patch,
  }
  await props.onUpdateViewPreferences(patch)
  const renderer = getPdfRenderer(props.reader)
  await renderer?.applyViewPreferences(patch)
}

const toggleImages = async () => {
  await applyPatch({ enableViewPdfImages: !prefs.value.enableViewPdfImages })
}

const toggleHighlightNotes = async () => {
  await applyPatch({
    enableAutoCreateHighlightNotes: !prefs.value.enableAutoCreateHighlightNotes,
  })
}

const toggleThemeRemap = async () => {
  await applyPatch({
    enablePdfThemeColorRemap: !prefs.value.enablePdfThemeColorRemap,
  })
}

const onRemapModeChange = async (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as PdfThemeColorRemapMode
  if (value === prefs.value.pdfThemeColorRemapMode) {
    return
  }
  await applyPatch({ pdfThemeColorRemapMode: value })
}

const onScrollModeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as PdfScrollMode
  if (value === scrollMode.value) {
    return
  }
  const layout = getPdfRenderer(props.reader)?.layout
  if (!layout) {
    return
  }
  layout.changeScrollMode(value)
  syncLayout()
}

const onSpreadModeChange = (event: Event) => {
  if (isSpreadDisabled.value) {
    return
  }
  const value = (event.target as HTMLSelectElement).value as PdfSpreadMode
  if (value === spreadMode.value) {
    return
  }
  const layout = getPdfRenderer(props.reader)?.layout
  if (!layout) {
    return
  }
  layout.changeSpreadMode(value)
  syncLayout()
}

const rotatePages = (delta: number) => {
  getPdfRenderer(props.reader)?.layout.rotatePages(delta)
}

const positionPanel = () => {
  const width = 340
  const trigger = getTriggerEl()
  const rect = trigger?.getBoundingClientRect()
  const isTriggerVisible =
    !!trigger &&
    !!rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    getComputedStyle(trigger).display !== 'none'

  if (isTriggerVisible && rect) {
    let left = rect.right - width
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    panelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex: '1000',
    }
    return
  }

  // Phone / more-menu entry: anchor to the top-right of the viewport.
  panelStyle.value = {
    position: 'fixed',
    top: '48px',
    left: `${Math.max(8, window.innerWidth - width - 8)}px`,
    width: `${width}px`,
    zIndex: '1000',
  }
}

const openPanel = async () => {
  open.value = true
  syncAll()
  await nextTick()
  positionPanel()
}

const toggleOpen = async () => {
  if (open.value) {
    open.value = false
    return
  }
  await openPanel()
}

const onDocClick = (e: MouseEvent) => {
  if (!open.value) {
    return
  }
  const target = e.target as Node
  if (getTriggerEl()?.contains(target) || panelRef.value?.contains(target)) {
    return
  }
  open.value = false
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  syncAll()
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', positionPanel)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', positionPanel)
})

watch(open, (value) => {
  if (value) {
    void nextTick().then(positionPanel)
  }
})

watch(
  () => props.openNonce,
  (nonce, prev) => {
    if (nonce && nonce !== prev) {
      void openPanel()
    }
  },
)

watch(
  () => props.reader,
  () => {
    syncAll()
  },
)
</script>

<template>
  <div class="foxycape-pdf-settings">
    <ClickableIconButton
      ref="triggerBtn"
      icon="lucide-settings"
      :class-name="['view-action', 'foxycape-pdf-settings-trigger', { 'is-open': open }]"
      :label="t('pdf_chrome_settings', 'Settings')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggleOpen"
    />
    <Teleport to="body">
      <div v-if="open" ref="panelRef" class="foxycape-pdf-settings-panel" role="dialog" :style="panelStyle">
        <div class="foxycape-pdf-settings-panel__body">
          <section class="foxycape-pdf-settings__group">
            <h3 class="foxycape-pdf-settings__heading">
              {{ t('pdf_chrome_settings_group_appearance', 'Appearance') }}
            </h3>
            <div class="foxycape-pdf-settings__card">
              <div class="foxycape-pdf-settings__row">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_images_name', 'Show actions on image hover') }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_images_desc',
                        'When enabled, hover an embedded PDF image to preview it fullscreen, or copy and download it.',
                      )
                    }}
                  </div>
                </div>
                <div class="checkbox-container" :class="{ 'is-enabled': prefs.enableViewPdfImages }" role="switch"
                  :aria-checked="prefs.enableViewPdfImages" tabindex="0" @click="toggleImages"
                  @keydown.enter.prevent="toggleImages" @keydown.space.prevent="toggleImages" />
              </div>

              <div class="foxycape-pdf-settings__row">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_theme_name', 'Adapt PDF pages to theme') }}
                    <sup class="foxycape-pdf-settings__beta">BETA</sup>
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_theme_desc',
                        'When enabled, PDF page colors adapt to the current theme.',
                      )
                    }}
                  </div>
                </div>
                <div class="checkbox-container" :class="{ 'is-enabled': prefs.enablePdfThemeColorRemap }" role="switch"
                  :aria-checked="prefs.enablePdfThemeColorRemap" tabindex="0" @click="toggleThemeRemap"
                  @keydown.enter.prevent="toggleThemeRemap" @keydown.space.prevent="toggleThemeRemap" />
              </div>

              <div class="foxycape-pdf-settings__row" :class="{ 'is-disabled': !prefs.enablePdfThemeColorRemap }">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_theme_scope_name', 'Theme adaptation scope') }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_theme_scope_desc',
                        'Choose whether adaptation applies in all themes, dark theme only, or light theme only.',
                      )
                    }}
                  </div>
                </div>
                <select class="dropdown foxycape-pdf-settings__select" :value="prefs.pdfThemeColorRemapMode"
                  :disabled="!prefs.enablePdfThemeColorRemap" @change="onRemapModeChange">
                  <option v-for="option in remapModeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>
          </section>

          <section class="foxycape-pdf-settings__group">
            <h3 class="foxycape-pdf-settings__heading">
              {{ t('pdf_chrome_settings_group_highlights', 'Highlights') }}
            </h3>
            <div class="foxycape-pdf-settings__card">
              <div class="foxycape-pdf-settings__row">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{
                      t(
                        'pdf_chrome_settings_highlight_notes_name',
                        'Auto-create notes from highlights',
                      )
                    }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_highlight_notes_desc',
                        'When enabled, new highlights are appended to a Markdown note with the same name as the PDF. Linked excerpts are added automatically; the note is created if it does not exist.',
                      )
                    }}
                  </div>
                </div>
                <div
                  class="checkbox-container"
                  :class="{ 'is-enabled': prefs.enableAutoCreateHighlightNotes }"
                  role="switch"
                  :aria-checked="prefs.enableAutoCreateHighlightNotes"
                  tabindex="0"
                  @click="toggleHighlightNotes"
                  @keydown.enter.prevent="toggleHighlightNotes"
                  @keydown.space.prevent="toggleHighlightNotes"
                />
              </div>
            </div>
          </section>

          <section class="foxycape-pdf-settings__group">
            <h3 class="foxycape-pdf-settings__heading">
              {{ t('pdf_chrome_settings_group_page', 'Page') }}
            </h3>
            <div class="foxycape-pdf-settings__card">
              <div class="foxycape-pdf-settings__row">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_scroll_name', 'Scroll direction') }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_scroll_desc',
                        'Choose how PDF pages scroll.',
                      )
                    }}
                  </div>
                </div>
                <select class="dropdown foxycape-pdf-settings__select" :value="scrollMode" @change="onScrollModeChange">
                  <option v-for="option in scrollModeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="foxycape-pdf-settings__row" :class="{ 'is-disabled': isSpreadDisabled }">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_spread_name', 'Page layout') }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_spread_desc',
                        'Show pages as single, facing, or book spreads. Unavailable in horizontal scroll.',
                      )
                    }}
                  </div>
                </div>
                <select class="dropdown foxycape-pdf-settings__select" :value="spreadMode" :disabled="isSpreadDisabled"
                  @change="onSpreadModeChange">
                  <option v-for="option in spreadModeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="foxycape-pdf-settings__row">
                <div class="foxycape-pdf-settings__text">
                  <div class="foxycape-pdf-settings__name">
                    {{ t('pdf_chrome_settings_rotate_name', 'Rotate pages') }}
                  </div>
                  <div class="foxycape-pdf-settings__desc">
                    {{
                      t(
                        'pdf_chrome_settings_rotate_desc',
                        'Rotate the document pages 90° clockwise or counterclockwise.',
                      )
                    }}
                  </div>
                </div>
                <div class="foxycape-pdf-settings__actions">
                  <ClickableIconButton
                    icon="lucide-rotate-ccw"
                    :label="t('pdf_chrome_settings_rotate_ccw', 'Rotate counterclockwise')"
                    @click="rotatePages(-90)"
                  />
                  <ClickableIconButton
                    icon="lucide-rotate-cw"
                    :label="t('pdf_chrome_settings_rotate_cw', 'Rotate clockwise')"
                    @click="rotatePages(90)"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.foxycape-pdf-settings {
  display: inline-flex;
  align-items: center;
  margin-inline-end: 2px;
  height: 100%;
}

.foxycape-pdf-settings-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: min(85vh, 960px);
  overflow: hidden;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m, 6px);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.mod-rtl .foxycape-pdf-settings-panel {
  direction: rtl;
}

.foxycape-pdf-settings-panel__body {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.foxycape-pdf-settings__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.foxycape-pdf-settings__heading {
  margin: 0;
  padding-inline: 2px;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: var(--font-semibold, 600);
  line-height: var(--line-height-tight);
}

.foxycape-pdf-settings__card {
  display: flex;
  flex-direction: column;
  /* border: 1px solid var(--background-modifier-border); */
  border-radius: var(--radius-m, 6px);
  background: var(--background-primary-alt);
  overflow: hidden;
}

.foxycape-pdf-settings__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 16px;
  padding-inline: 14px;
}

.foxycape-pdf-settings__row + .foxycape-pdf-settings__row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 80%;
  height: 1px;
  transform: translateX(-50%);
  background: var(--background-modifier-border);
}

.foxycape-pdf-settings__row.is-disabled {
  opacity: 0.55;
}

.foxycape-pdf-settings__text {
  flex: 1 1 auto;
  min-width: 0;
}

.foxycape-pdf-settings__name {
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: var(--font-medium, 500);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  overflow: hidden;
}

.foxycape-pdf-settings__beta {
  color: var(--text-accent);
  font-size: 0.7em;
  font-weight: 600;
  letter-spacing: 0.04em;
  vertical-align: super;
  top: -2px;
}

.foxycape-pdf-settings__desc {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  padding-block-start: var(--size-4-1);
  line-height: var(--line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
}

.foxycape-pdf-settings__row :deep(.checkbox-container) {
  flex: 0 0 auto;
  cursor: pointer;
}

.foxycape-pdf-settings__select {
  flex: 0 0 auto;
  max-width: 7.5rem;
}

.foxycape-pdf-settings__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}
</style>
