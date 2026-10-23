<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X } from '@lucide/vue'
import type { AiAccessMode } from '../accessChoice'
import { loadAiTrafficPacks, type AiTrafficPack } from '../trafficPacks'
import { tryGetAiRuntime } from '../runtime'
import { formatTokenAmount } from '../formatTokenAmount'
import { loadShareTopupEligible } from '../shareTopup'

const props = defineProps<{
  mode: AiAccessMode
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  close: []
  configureKey: []
  enterLicense: []
  purchase: []
  freeLicense: []
  shareTraffic: []
}>()

const isQuota = computed(() => props.mode === 'quota')
const title = computed(() =>
  isQuota.value
    ? props.t('ai_quota_title', 'AI usage is used up')
    : props.t('ai_access_title', 'Use the official model'),
)
const description = computed(() =>
  isQuota.value
    ? props.t(
        'ai_quota_choice',
        'The license is still valid, but the AI usage on it is used up. A traffic pack tops up this license. You can also switch to your own AI key.',
      )
    : props.t(
        'ai_access_choice',
        'The official model needs a license. AI usage is stored on that license. You can also configure your own AI key and skip official usage.',
      ),
)

const packs = ref<AiTrafficPack[]>([])
const canShareTraffic = ref(false)

onMounted(() => {
  if (!isQuota.value) {
    return
  }
  const runtime = tryGetAiRuntime()
  if (!runtime) {
    return
  }
  void loadAiTrafficPacks(runtime.apiClient).then((next) => {
    packs.value = next
  })
  void loadShareTopupEligible(runtime.apiClient, runtime.getLicense()).then((eligible) => {
    canShareTraffic.value = eligible
  })
})
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
    <ul v-if="isQuota && packs.length" class="fpdf-dialog__packs">
      <li v-for="pack in packs" :key="pack.title + pack.tokenCount">
        {{ pack.title }} · {{ t('ai_traffic_includes', 'Includes {tokens}', { tokens: formatTokenAmount(pack.tokenCount) }) }}
      </li>
    </ul>
    <div class="fpdf-dialog__actions">
      <button type="button" class="clickable-icon fpdf-action" @click="emit('configureKey')">
        {{ t('ai_configure_key', 'Configure AI key') }}
      </button>
      <button v-if="isQuota" type="button" class="clickable-icon fpdf-action mod-cta" @click="emit('purchase')">
        {{ t('ai_buy_quota', 'Buy an AI traffic pack') }}
      </button>
      <button v-else type="button" class="clickable-icon fpdf-action mod-cta" @click="emit('enterLicense')">
        {{ t('ai_enter_license', 'Enter a license') }}
      </button>
      <button v-if="!isQuota" type="button" class="clickable-icon fpdf-action" @click="emit('freeLicense')">
        {{ t('ai_free_license', 'Get a license for free') }}
      </button>
      <button
        v-if="isQuota && canShareTraffic"
        type="button"
        class="clickable-icon fpdf-action"
        @click="emit('shareTraffic')"
      >
        {{ t('ai_share_traffic', 'Share to get 1M AI traffic') }}
      </button>
    </div>
  </div>
</template>
