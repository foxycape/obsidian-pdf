<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { applyIcon } from './applyIcon'

const props = defineProps<{
  icon: string
  className?: string
}>()

const el = ref<HTMLElement | null>(null)

const render = () => applyIcon(el.value, props.icon)

onMounted(render)
watch(() => props.icon, render)
</script>

<template>
  <!-- Decorative / mixed-content icon host. Pure icon buttons should setIcon on the button itself. -->
  <span
    ref="el"
    :class="['foxycape-obsidian-icon', props.className]"
    aria-hidden="true"
  />
</template>
<style scoped>
.foxycape-obsidian-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>