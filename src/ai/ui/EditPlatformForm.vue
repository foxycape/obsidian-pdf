<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { getLlm, type LlmSetting } from '../llm'

const props = defineProps<{
  platform?: LlmSetting | null
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  saved: [platform?: LlmSetting]
  cancel: []
}>()

const isAdd = computed(() => !props.platform?.id)
const platformName = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const errorMessage = ref('')
const isSaving = ref(false)

watch(
  () => props.platform,
  (platform) => {
    platformName.value = platform?.platform ?? ''
    baseUrl.value = platform?.baseUrl ?? ''
    apiKey.value = platform?.apiKey ?? ''
    errorMessage.value = ''
  },
  { immediate: true },
)

const save = async () => {
  const name = platformName.value.trim()
  const url = baseUrl.value.trim()
  if (!name || !url) {
    errorMessage.value = props.t('ai_model_form_required', 'Provider name and Base URL are required')
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    errorMessage.value = props.t('ai_invalid_base_url', 'Base URL must start with http:// or https://')
    return
  }
  isSaving.value = true
  errorMessage.value = ''
  try {
    const llm = getLlm()
    if (isAdd.value) {
      const added = await llm.modelProvider.addSetting({
        id: '',
        platform: name,
        baseUrl: url,
        apiKey: apiKey.value.trim() || undefined,
        models: [],
      })
      emit('saved', added)
      return
    }
    if (!props.platform) {
      return
    }
    const next = {
      ...props.platform,
      platform: name,
      baseUrl: url,
      apiKey: apiKey.value.trim() || undefined,
    }
    await llm.modelProvider.updateSetting(next)
    emit('saved')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form class="fpdf-form" @submit.prevent="save">
    <label>
      {{ t('ai_custom_platform', 'Platform name') }}
      <input
        v-model="platformName"
        class="fpdf-input"
        :placeholder="t('ai_example_placeholder', '例如：{value}', { value: 'Deepseek' })"
        :disabled="!!platform?.isOfficial"
      />
    </label>
    <label>
      {{ t('ai_custom_base_url', 'Base URL') }}
      <input
        v-model="baseUrl"
        class="fpdf-input"
        :placeholder="t('ai_example_placeholder', '例如：{value}', { value: 'https://api.deepseek.com/v1' })"
        :disabled="!!platform?.isOfficial"
      />
    </label>
    <label>
      {{ t('ai_custom_api_key', 'API key') }}
      <input
        v-model="apiKey"
        class="fpdf-input"
        type="password"
        :placeholder="t('ai_example_placeholder', '例如：{value}', { value: 'sk-…' })"
      />
    </label>
    <p v-if="errorMessage" class="fpdf-error">{{ errorMessage }}</p>
    <div class="fpdf-form__actions">
      <button type="button" class="clickable-icon fpdf-form-btn" @click="emit('cancel')">
        {{ t('ai_cancel', 'Cancel') }}
      </button>
      <button type="submit" class="clickable-icon fpdf-form-btn mod-cta" :disabled="isSaving">
        <LoaderCircle v-if="isSaving" class="fpdf-icon fpdf-icon--sm fpdf-spin" />
        {{ t('ai_confirm', 'Confirm') }}
      </button>
    </div>
  </form>
</template>
