<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, ChevronLeft, LoaderCircle, Plus, Trash2, X } from '@lucide/vue'
import { DefaultOfficialPlatformId, getLlm, type LlmModel, type LlmSetting } from '../llm'
import { useHistoryLayer } from '@/history/useHistoryLayer'
import EditModelForm from './EditModelForm.vue'
import EditPlatformForm from './EditPlatformForm.vue'

const props = defineProps<{
  t: (key: string, fallback: string, named?: object) => string
}>()

const emit = defineEmits<{
  close: []
}>()

const platforms = ref<LlmSetting[]>([])
const view = ref<'list' | 'platform' | 'model'>('list')
const editingPlatform = ref<LlmSetting | null>(null)
const pendingDelete = ref<LlmSetting | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)

const isOfficialPlatform = (platform: LlmSetting) =>
  platform.isOfficial || platform.id === DefaultOfficialPlatformId

const officialPlatform = computed(() => platforms.value.find(isOfficialPlatform) ?? null)
const officialModel = computed(() => officialPlatform.value?.models[0] ?? null)
const customPlatforms = computed(() => platforms.value.filter((platform) => !isOfficialPlatform(platform)))

const titleText = computed(() => {
  if (view.value === 'model') {
    return props.t('ai_add_model_for', '{name} · Add model', {
      name: editingPlatform.value?.platform || props.t('ai_add_model', 'Add model'),
    })
  }
  if (view.value === 'platform') {
    return editingPlatform.value
      ? props.t('ai_edit_platform', 'Edit provider')
      : props.t('ai_add_platform', 'Add platform')
  }
  return props.t('ai_model_settings', 'Model')
})

const load = async (options?: { silent?: boolean }) => {
  const isSilent = options?.silent ?? platforms.value.length > 0
  if (!isSilent) {
    isLoading.value = true
  }
  try {
    platforms.value = await getLlm().modelProvider.getSettings()
  } finally {
    isLoading.value = false
  }
}

const useModel = async (platform: LlmSetting, model: LlmModel) => {
  if (model.isInUse) {
    return
  }
  await getLlm().modelProvider.setInUseModel(platform.id, model.name)
  await load({ silent: true })
}

const askRemovePlatform = (platform: LlmSetting) => {
  if (isOfficialPlatform(platform)) {
    return
  }
  pendingDelete.value = platform
}

const confirmRemovePlatform = async () => {
  const platform = pendingDelete.value
  if (!platform || isOfficialPlatform(platform)) {
    pendingDelete.value = null
    return
  }
  isDeleting.value = true
  try {
    await getLlm().modelProvider.removeSetting(platform.id)
    pendingDelete.value = null
    await load()
  } finally {
    isDeleting.value = false
  }
}

const removeModel = async (platform: LlmSetting, model: LlmModel) => {
  if (platform.isOfficial) {
    return
  }
  await getLlm().modelProvider.removeModel(platform.id, model.name)
  await load()
}

const openAddPlatform = () => {
  editingPlatform.value = null
  view.value = 'platform'
}

const openEditPlatform = (platform: LlmSetting) => {
  if (isOfficialPlatform(platform)) {
    return
  }
  editingPlatform.value = platform
  view.value = 'platform'
}

const openAddModel = (platform: LlmSetting) => {
  editingPlatform.value = platform
  view.value = 'model'
}

const backToList = () => {
  view.value = 'list'
  editingPlatform.value = null
  pendingDelete.value = null
}

useHistoryLayer(
  () => view.value !== 'list',
  backToList,
)

const onSaved = async (platform?: LlmSetting) => {
  if (platform && !isOfficialPlatform(platform)) {
    editingPlatform.value = platform
    view.value = 'model'
    pendingDelete.value = null
    await load({ silent: true })
    return
  }
  backToList()
  await load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="fpdf-dialog fpdf-dialog--wide" @pointerdown.stop>
    <header class="fpdf-dialog__bar">
      <button
        v-if="view !== 'list'"
        type="button"
        class="clickable-icon fpdf-icon-btn"
        :aria-label="t('ai_back', 'Back')"
        @click="backToList"
      >
        <ChevronLeft class="fpdf-icon" />
      </button>
      <div class="fpdf-dialog__title">{{ titleText }}</div>
      <button type="button" class="clickable-icon fpdf-icon-btn" :aria-label="t('pdf_search_close', 'Close')" @click="emit('close')">
        <X class="fpdf-icon" />
      </button>
    </header>

    <EditPlatformForm
      v-if="view === 'platform'"
      :platform="editingPlatform"
      :t="t"
      @saved="onSaved"
      @cancel="backToList"
    />
    <EditModelForm
      v-else-if="view === 'model' && editingPlatform"
      :platform="editingPlatform"
      :t="t"
      @saved="onSaved()"
    />
    <template v-else>
      <div class="fpdf-dialog__list fpdf-model-list">
        <p v-if="isLoading && !platforms.length" class="fpdf-muted">{{ t('share_loading_text', 'Loading...') }}</p>
        <template v-else>
          <button
            v-if="officialPlatform && officialModel"
            type="button"
            class="clickable-icon fpdf-menu-item fpdf-model-row"
            :class="{ 'is-active': officialModel.isInUse }"
            @click="useModel(officialPlatform, officialModel)"
          >
            <span class="fpdf-menu-item__label">{{ t('ai_official_model', 'Official model') }}</span>
            <Check class="fpdf-icon" :style="{ visibility: officialModel.isInUse ? 'visible' : 'hidden' }" />
          </button>
          <section v-for="platform in customPlatforms" :key="platform.id" class="fpdf-model-section">
            <div class="fpdf-platform-head">
              <button type="button" class="clickable-icon fpdf-platform-row__name" @click="openEditPlatform(platform)">
                {{ platform.platform }}
              </button>
              <button
                type="button"
                class="clickable-icon fpdf-icon-btn"
                :aria-label="t('ai_add_model', 'Add model')"
                @click="openAddModel(platform)"
              >
                <Plus class="fpdf-icon fpdf-icon--sm" />
              </button>
              <button
                type="button"
                class="clickable-icon fpdf-icon-btn"
                :aria-label="t('ai_delete_platform', 'Delete provider')"
                @click="askRemovePlatform(platform)"
              >
                <Trash2 class="fpdf-icon fpdf-icon--sm" />
              </button>
            </div>
            <button
              v-for="model in platform.models"
              :key="model.name"
              type="button"
              class="clickable-icon fpdf-menu-item fpdf-model-row"
              :class="{ 'is-active': model.isInUse }"
              @click="useModel(platform, model)"
            >
              <span class="fpdf-menu-item__label">{{ model.title || model.name }}</span>
              <Check class="fpdf-icon" :style="{ visibility: model.isInUse ? 'visible' : 'hidden' }" />
              <span
                class="fpdf-model-row__delete"
                role="button"
                :aria-label="t('ai_delete_model', 'Delete model')"
                @click.stop="removeModel(platform, model)"
              >
                <Trash2 class="fpdf-icon fpdf-icon--sm" />
              </span>
            </button>
          </section>
        </template>
      </div>
      <div class="fpdf-dialog__footer">
        <button type="button" class="clickable-icon fpdf-outline-btn" @click="openAddPlatform">
          <Plus class="fpdf-icon fpdf-icon--sm" />
          {{ t('ai_add_platform', 'Add platform') }}
        </button>
      </div>
    </template>

    <div v-if="pendingDelete" class="fpdf-confirm" @pointerdown.stop @click.self="pendingDelete = null">
      <div class="fpdf-confirm__card">
        <p class="fpdf-confirm__title">
          {{ t('ai_delete_platform_confirm', 'Delete provider “{name}”?', { name: pendingDelete.platform }) }}
        </p>
        <p class="fpdf-muted">
          {{ t('ai_delete_platform_hint', 'Models under this provider will also be removed.') }}
        </p>
        <div class="fpdf-form__actions">
          <button type="button" class="clickable-icon fpdf-form-btn" :disabled="isDeleting" @click="pendingDelete = null">
            {{ t('ai_cancel', 'Cancel') }}
          </button>
          <button type="button" class="clickable-icon fpdf-form-btn mod-warning" :disabled="isDeleting" @click="confirmRemovePlatform">
            <LoaderCircle v-if="isDeleting" class="fpdf-icon fpdf-icon--sm fpdf-spin" />
            {{ t('share_delete', 'Delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
