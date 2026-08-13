<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { useApplyIcon } from './applyIcon'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  icon: string
  /** Extra classes, e.g. `view-action`, `nav-action-button`. */
  className?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  label?: string
  title?: string
}>()

const attrs = useAttrs()
const el = ref<HTMLButtonElement | null>(null)
useApplyIcon(el, () => props.icon)

const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

defineExpose({ el })
</script>

<template>
  <button
    ref="el"
    type="button"
    class="clickable-icon"
    :class="[className, attrs.class]"
    v-bind="forwardedAttrs"
    :aria-label="label ?? (attrs['aria-label'] as string | undefined)"
  />
</template>
