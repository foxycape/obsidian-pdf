<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { ChevronDown, ChevronUp } from '@lucide/vue'

const props = defineProps<{
  text: string
  lines: 2 | 3 | 5
}>()

const root = ref<HTMLElement | null>(null)
const expanded = ref(false)
const canExpand = ref(false)

const measure = () => {
  const el = root.value
  if (!el || expanded.value) {
    return
  }
  canExpand.value = el.scrollHeight > el.clientHeight + 4
}

const toggle = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  expanded.value = !expanded.value
  if (expanded.value) {
    canExpand.value = true
    return
  }
  void nextTick(measure)
}

onMounted(() => {
  void nextTick(measure)
})

watch(
  () => [props.text, props.lines] as const,
  async () => {
    expanded.value = false
    canExpand.value = false
    await nextTick()
    measure()
  },
)
</script>

<template>
  <div
    ref="root"
    class="foxycape-pdf-clamp"
    :class="{
      'is-clamped': !expanded,
      'is-2': lines === 2,
      'is-3': lines === 3,
      'is-5': lines === 5,
    }"
  >
    {{ text }}
    <button
      v-if="canExpand"
      type="button"
      class="clickable-icon foxycape-pdf-clamp__toggle"
      @click="toggle"
    >
      <ChevronUp v-if="expanded" class="foxycape-pdf-clamp__icon" />
      <ChevronDown v-else class="foxycape-pdf-clamp__icon" />
    </button>
  </div>
</template>

<style scoped>
.foxycape-pdf-clamp {
  position: relative;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.foxycape-pdf-clamp.is-clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.foxycape-pdf-clamp.is-clamped.is-2 {
  -webkit-line-clamp: 2;
}

.foxycape-pdf-clamp.is-clamped.is-3 {
  -webkit-line-clamp: 3;
}

.foxycape-pdf-clamp.is-clamped.is-5 {
  -webkit-line-clamp: 5;
}

.foxycape-pdf-clamp__toggle {
  position: absolute;
  inset-inline-end: 2px;
  inset-block-end: 2px;
  width: 24px;
  height: 24px;
  box-shadow: none;
  background: var(--background-secondary);
}

.foxycape-pdf-clamp__icon {
  width: 12px;
  height: 12px;
}
</style>
