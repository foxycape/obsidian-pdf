<script setup lang="ts">
import { nextTick, ref } from 'vue'
import ClickableIconButton from '@/ui/ClickableIconButton.vue'
import { useDismissOnOutside } from '@/ui/useDismissOnOutside'
import type { MarkSortMode } from './markListGroup'

type SortOption = {
  mode: MarkSortMode
  label: string
}

defineProps<{
  count: number
  countLabel: string
  sortMode: MarkSortMode
  sortOptions: SortOption[]
  sortLabel: string
  showSearch?: boolean
  searchLabel?: string
  searchPlaceholder?: string
  keyword?: string
}>()

const emit = defineEmits<{
  'update:sortMode': [mode: MarkSortMode]
  'update:keyword': [value: string]
}>()

const sortMenuOpen = ref(false)
const searchOpen = ref(false)
const sortMenuRoot = ref<HTMLElement | null>(null)
const searchMenuRoot = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)

const closeSortMenu = () => {
  sortMenuOpen.value = false
}

const closeSearch = () => {
  searchOpen.value = false
}

const closeMenus = () => {
  closeSortMenu()
  closeSearch()
}

const toggleSearch = async () => {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    closeSortMenu()
    await nextTick()
    searchInputEl.value?.focus()
  }
}

const toggleSortMenu = () => {
  sortMenuOpen.value = !sortMenuOpen.value
  if (sortMenuOpen.value) {
    closeSearch()
  }
}

const applySort = (mode: MarkSortMode) => {
  emit('update:sortMode', mode)
  closeSortMenu()
}

const onSearchInput = (event: Event) => {
  emit('update:keyword', (event.target as HTMLInputElement).value)
}

useDismissOnOutside(
  () => sortMenuOpen.value,
  () => [sortMenuRoot.value],
  closeSortMenu,
)
useDismissOnOutside(
  () => searchOpen.value,
  () => [searchMenuRoot.value],
  closeSearch,
)

defineExpose({ closeMenus })
</script>

<template>
  <div class="foxycape-pdf-list-toolbar">
    <span class="foxycape-pdf-list-toolbar__count" :aria-label="countLabel">{{ count }}</span>
    <div class="foxycape-pdf-list-toolbar__actions">
      <slot name="leading" :close-menus="closeMenus" />
      <div v-if="showSearch" ref="searchMenuRoot" class="foxycape-pdf-list-toolbar__pop">
        <ClickableIconButton
          icon="search"
          :class-name="['nav-action-button force-small-icon', { 'is-active': searchOpen || Boolean(keyword?.trim()) }]"
          :label="searchLabel"
          :aria-expanded="searchOpen"
          @click="toggleSearch"
        />
        <div v-if="searchOpen" class="foxycape-pdf-list-toolbar__search" @pointerdown.stop>
          <input
            ref="searchInputEl"
            type="search"
            spellcheck="false"
            :value="keyword"
            :placeholder="searchPlaceholder"
            :aria-label="searchLabel"
            @input="onSearchInput"
          />
        </div>
      </div>
      <div ref="sortMenuRoot" class="foxycape-pdf-list-toolbar__pop">
        <ClickableIconButton
          icon="arrow-up-down"
          :class-name="['nav-action-button force-small-icon', { 'is-active': sortMenuOpen }]"
          :label="sortLabel"
          :aria-expanded="sortMenuOpen"
          @click="toggleSortMenu"
        />
        <div v-if="sortMenuOpen" class="foxycape-pdf-list-toolbar__sort" role="menu" @pointerdown.stop>
          <button
            v-for="option in sortOptions"
            :key="option.mode"
            type="button"
            class="foxycape-pdf-list-toolbar__sort-item"
            :class="{ 'is-active': sortMode === option.mode }"
            role="menuitemradio"
            :aria-checked="sortMode === option.mode"
            @click="applySort(option.mode)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.foxycape-pdf-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 32px;
  margin: 6px 12px 4px;
  padding-inline: 8px 4px;
  border-radius: var(--radius-s);
  background: var(--background-modifier-hover);
  flex: 0 0 auto;
}

.foxycape-pdf-list-toolbar__count {
  min-width: 0;
  margin-inline-start: 8px;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  font-variant-numeric: tabular-nums;
}

.foxycape-pdf-list-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  color: var(--text-muted);
}

.foxycape-pdf-list-toolbar__actions :deep(.is-active) {
  color: var(--text-accent);
}

.foxycape-pdf-list-toolbar__pop {
  position: relative;
  flex: 0 0 auto;
}

.foxycape-pdf-list-toolbar__search,
.foxycape-pdf-list-toolbar__sort {
  position: absolute;
  inset-block-start: calc(100% + 4px);
  inset-inline-end: 0;
  z-index: 20;
  border-radius: var(--radius-m);
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  box-shadow: var(--shadow-s);
}

.foxycape-pdf-list-toolbar__search {
  width: 220px;
  padding: 8px;
}

.foxycape-pdf-list-toolbar__search input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
}

.foxycape-pdf-list-toolbar__search input:focus,
.foxycape-pdf-list-toolbar__search input:focus-visible {
  border-color: var(--background-modifier-border);
  box-shadow: none;
  outline: none;
}

.foxycape-pdf-list-toolbar__sort {
  min-width: 160px;
  padding: 4px;
}

.foxycape-pdf-list-toolbar__sort-item {
  display: block;
  width: 100%;
  border: none;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  text-align: start;
  padding-block: 6px;
  padding-inline: 8px;
  cursor: pointer;
  box-shadow: none;
  white-space: nowrap;
}

.foxycape-pdf-list-toolbar__sort-item:hover {
  background: var(--background-modifier-hover);
}

.foxycape-pdf-list-toolbar__sort-item.is-active {
  color: var(--text-accent);
  font-weight: 600;
}
</style>
