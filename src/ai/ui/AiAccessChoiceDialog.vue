<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import type { AiAccessMode } from '../accessChoice'

const props = defineProps<{
  mode: AiAccessMode
  t: (key: string, fallback: string) => string
}>()

const emit = defineEmits<{
  close: []
  configureKey: []
  enterLicense: []
  purchase: []
}>()

const isQuota = computed(() => props.mode === 'quota')
const title = computed(() =>
  isQuota.value
    ? props.t('ai_quota_title', 'Official quota is used up')
    : props.t('ai_access_title', 'Explain, translate, and ask'),
)
const description = computed(() =>
  isQuota.value
    ? props.t('ai_quota_choice', 'These features are unavailable for now. Configure your own key, or buy more quota.')
    : props.t('ai_access_choice', 'These features need a model. Enter a license to use the official model, or configure your own key.'),
)
</script>

<template>
  <div class="fpdf-dialog" data-id="ai-access-choice" :data-mode="mode" @pointerdown.stop>
    <header class="fpdf-dialog__bar">
      <div class="fpdf-dialog__title">{{ title }}</div>
      <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_close', 'Close')" @click="emit('close')">
        <X class="fpdf-icon" />
      </button>
    </header>
    <p class="fpdf-dialog__text">{{ description }}</p>
    <div class="fpdf-dialog__actions">
      <button v-if="isQuota" type="button" class="clickable-icon fpdf-action mod-cta" @click="emit('purchase')">
        {{ t('ai_buy_quota', 'Buy an AI traffic pack') }}
      </button>
      <button type="button" class="clickable-icon fpdf-action" @click="emit('configureKey')">{{ t('ai_configure_key', 'Configure your own key') }}</button>
      <button v-if="!isQuota" type="button" class="clickable-icon fpdf-action mod-cta" @click="emit('enterLicense')">
        {{ t('ai_enter_license', 'Enter a license') }}
      </button>
      <button v-if="!isQuota" type="button" class="clickable-icon fpdf-action" @click="emit('purchase')">{{ t('ai_purchase', 'Purchase') }}</button>
    </div>
  </div>
</template>
