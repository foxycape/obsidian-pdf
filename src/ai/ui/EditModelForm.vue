<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, LoaderCircle, X } from '@lucide/vue'
import { getLlm, type LlmModel, type LlmSetting } from '../llm'

type AddModelMode = 'manual' | 'fetch'

const asErrorMessage = (error: unknown): string => {
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; cause?: unknown; error?: unknown; status?: unknown }
    const nested =
      record.error && typeof record.error === 'object' && record.error !== null && 'message' in record.error
        ? String((record.error as { message?: unknown }).message ?? '').trim()
        : ''
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const cause =
      record.cause instanceof Error
        ? record.cause.message.trim()
        : typeof record.cause === 'string'
          ? record.cause.trim()
          : ''
    const parts = [message, nested, cause].filter((part, index, all) => part && all.indexOf(part) === index)
    if (parts.length) {
      const text = parts.join(' · ')
      const status = typeof record.status === 'number' ? String(record.status) : ''
      return status && !text.startsWith(status) ? `${status} ${text}` : text
    }
  }
  return String(error)
}

const props = defineProps<{
  platform: LlmSetting
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  saved: []
}>()

const mode = ref<AddModelMode>('fetch')
const name = ref('')
const title = ref('')
const keyword = ref('')
const remoteModels = ref<LlmModel[]>([])
const selectedNames = ref<string[]>([])
const errorMessage = ref('')
const listError = ref('')
const hideFetchButton = ref(false)
const isSaving = ref(false)
const isListing = ref(false)
const hasListed = ref(false)
const showFetchButton = computed(() => isListing.value || !hideFetchButton.value)

const existingNames = computed(() => {
  const names = new Set<string>()
  for (const model of props.platform.models ?? []) {
    names.add(model.name.toLowerCase())
  }
  return names
})

const isExisting = (modelName: string) => existingNames.value.has(modelName.toLowerCase())

const filteredRemoteModels = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return remoteModels.value
  }
  return remoteModels.value.filter((model) => {
    const display = (model.title || '').toLowerCase()
    return model.name.toLowerCase().includes(query) || display.includes(query)
  })
})

const selectableFiltered = computed(() =>
  filteredRemoteModels.value.filter((model) => !isExisting(model.name)),
)

const hasAllFilteredSelected = computed(
  () =>
    selectableFiltered.value.length > 0 &&
    selectableFiltered.value.every((model) => selectedNames.value.includes(model.name)),
)

const selectedCount = computed(() => selectedNames.value.length)

watch(
  () => props.platform.id,
  () => {
    name.value = ''
    title.value = ''
    keyword.value = ''
    remoteModels.value = []
    selectedNames.value = []
    errorMessage.value = ''
    listError.value = ''
    hideFetchButton.value = false
    hasListed.value = false
    mode.value = 'fetch'
    void listRemote()
  },
)

const switchMode = (next: AddModelMode) => {
  if (mode.value === next) {
    return
  }
  mode.value = next
  errorMessage.value = ''
  if (next === 'fetch') {
    hideFetchButton.value = false
    listError.value = ''
  }
}

const isTimeoutError = (error: unknown) => {
  const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  return errorName.includes('Timeout') || /timed?\s*out/i.test(asErrorMessage(error))
}

const listRemote = async () => {
  isListing.value = true
  hideFetchButton.value = false
  errorMessage.value = ''
  listError.value = ''
  try {
    remoteModels.value = await getLlm().modelProvider.listModels(
      props.platform.baseUrl,
      props.platform.apiKey ?? '',
    )
    selectedNames.value = selectedNames.value.filter((modelName) =>
      remoteModels.value.some((model) => model.name === modelName && !isExisting(modelName)),
    )
    hasListed.value = true
  } catch (error) {
    hasListed.value = false
    remoteModels.value = []
    selectedNames.value = []
    hideFetchButton.value = true
    listError.value = isTimeoutError(error)
      ? props.t('ai_fetch_models_timeout', 'Timed out after 8 seconds')
      : asErrorMessage(error)
  } finally {
    isListing.value = false
  }
}

onMounted(() => {
  void listRemote()
})

const isRemoteSelected = (modelName: string) => selectedNames.value.includes(modelName)

const toggleRemote = (model: LlmModel) => {
  if (isExisting(model.name)) {
    return
  }
  if (isRemoteSelected(model.name)) {
    selectedNames.value = selectedNames.value.filter((item) => item !== model.name)
    return
  }
  selectedNames.value = [...selectedNames.value, model.name]
}

const toggleSelectFiltered = () => {
  const names = selectableFiltered.value.map((model) => model.name)
  if (hasAllFilteredSelected.value) {
    selectedNames.value = selectedNames.value.filter((item) => !names.includes(item))
    return
  }
  selectedNames.value = [...new Set([...selectedNames.value, ...names])]
}

const saveManual = async () => {
  const modelName = name.value.trim()
  if (!modelName) {
    errorMessage.value = props.t('ai_model_name_required', 'Model name is required')
    return
  }
  isSaving.value = true
  errorMessage.value = ''
  try {
    await getLlm().modelProvider.addModel(props.platform.id, {
      name: modelName,
      title: title.value.trim() || modelName,
    })
    emit('saved')
  } catch (error) {
    errorMessage.value = asErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

const saveSelected = async () => {
  if (!selectedCount.value) {
    errorMessage.value = props.t('ai_select_models_required', 'Select at least one model')
    return
  }
  isSaving.value = true
  errorMessage.value = ''
  try {
    const adding = remoteModels.value.filter((model) => selectedNames.value.includes(model.name))
    for (const model of adding) {
      await getLlm().modelProvider.addModel(props.platform.id, {
        name: model.name,
        title: model.title || model.name,
      })
    }
    emit('saved')
  } catch (error) {
    errorMessage.value = asErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form class="fpdf-form" @submit.prevent="mode === 'manual' ? saveManual() : saveSelected()">
    <div class="fpdf-segment">
      <button
        type="button"
        class="clickable-icon fpdf-segment__btn"
        :class="{ 'is-active': mode === 'fetch' }"
        @click="switchMode('fetch')"
      >
        {{ t('ai_fetch_models', 'Fetch models') }}
      </button>
      <button
        type="button"
        class="clickable-icon fpdf-segment__btn"
        :class="{ 'is-active': mode === 'manual' }"
        @click="switchMode('manual')"
      >
        {{ t('ai_add_model_manually', 'Add manually') }}
      </button>
    </div>

    <template v-if="mode === 'manual'">
      <label>
        {{ t('ai_model_name', 'Model name') }}
        <input v-model="name" class="fpdf-input" placeholder="deepseek-chat" />
      </label>
      <label>
        {{ t('ai_model_title', 'Display name') }}
        <input v-model="title" class="fpdf-input" placeholder="DeepSeek Chat" />
      </label>
    </template>

    <template v-else>
      <p class="fpdf-muted">
        {{ t('ai_fetch_models_hint', 'Fetch available models from this provider, then select one or more to add.') }}
      </p>
      <div v-if="showFetchButton || remoteModels.length" class="fpdf-fetch-row">
        <div v-if="remoteModels.length" class="fpdf-fetch-row__filter">
          <input v-model="keyword" class="fpdf-input" :placeholder="t('ai_filter_models', 'Filter models')" />
          <button
            v-if="keyword"
            type="button"
            class="clickable-icon fpdf-icon-btn fpdf-fetch-row__clear"
            :aria-label="t('pdf_search_close', 'Close')"
            @click="keyword = ''"
          >
            <X class="fpdf-icon fpdf-icon--sm" />
          </button>
        </div>
        <button type="button" class="clickable-icon fpdf-form-btn" :disabled="isListing" @click="listRemote">
          <LoaderCircle v-if="isListing" class="fpdf-icon fpdf-icon--sm fpdf-spin" />
          {{
            isListing
              ? t('ai_fetching_models', 'Fetching models…')
              : hasListed
                ? t('ai_fetch_models_again', 'Fetch again')
                : t('ai_fetch_models', 'Fetch models')
          }}
        </button>
      </div>
      <div v-if="listError && !isListing" class="fpdf-fetch-error">
        <p class="fpdf-error">{{ listError }}</p>
        <button type="button" class="clickable-icon fpdf-form-btn" @click="switchMode('manual')">
          {{ t('ai_add_model_manually_action', 'Add model manually') }}
        </button>
      </div>
      <div v-if="hasListed" class="fpdf-remote-models">
        <div v-if="remoteModels.length" class="fpdf-remote-models__bar">
          <button
            type="button"
            class="clickable-icon fpdf-text-btn"
            :disabled="!selectableFiltered.length"
            @click="toggleSelectFiltered"
          >
            {{
              hasAllFilteredSelected
                ? t('ai_clear_selected_models', 'Clear selection')
                : t('ai_select_all_models', 'Select all')
            }}
          </button>
          <span class="fpdf-muted">{{ t('ai_selected_model_count', '{count} selected', { count: selectedCount }) }}</span>
        </div>
        <div v-if="filteredRemoteModels.length" class="fpdf-remote-models__list">
          <button
            v-for="model in filteredRemoteModels"
            :key="model.name"
            type="button"
            class="clickable-icon fpdf-menu-item"
            :class="{ 'is-active': isRemoteSelected(model.name) }"
            :disabled="isExisting(model.name)"
            @click="toggleRemote(model)"
          >
            <span class="fpdf-check" :class="{ 'is-on': isRemoteSelected(model.name) }">
              <Check v-if="isRemoteSelected(model.name)" class="fpdf-icon fpdf-icon--sm" />
            </span>
            <span class="fpdf-menu-item__label">{{ model.title || model.name }}</span>
            <span v-if="isExisting(model.name)" class="fpdf-muted">{{ t('ai_model_already_added', 'Added') }}</span>
          </button>
        </div>
        <p v-else class="fpdf-muted fpdf-remote-models__empty">
          {{
            remoteModels.length
              ? t('ai_search_models_empty', 'No matching models')
              : t('ai_fetch_models_empty', 'No models to add')
          }}
        </p>
      </div>
    </template>

    <p v-if="errorMessage" class="fpdf-error">{{ errorMessage }}</p>
    <button type="submit" class="clickable-icon fpdf-form-btn mod-cta" :disabled="isSaving || (mode === 'fetch' && !hasListed)">
      <LoaderCircle v-if="isSaving" class="fpdf-icon fpdf-icon--sm fpdf-spin" />
      {{ t('ai_confirm', 'Confirm') }}
    </button>
  </form>
</template>
