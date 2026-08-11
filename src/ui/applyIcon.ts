import { setIcon } from 'obsidian'
import type { Ref } from 'vue'
import { onMounted, watch } from 'vue'

/** Apply Obsidian `setIcon` to a host element (typically an icon-only button). */
export const applyIcon = (el: HTMLElement | null | undefined, icon: string) => {
  if (!el || !icon) {
    return
  }
  setIcon(el, icon)
}

/**
 * Keep `setIcon` in sync with a Vue template ref and icon name.
 * Prefer this for pure icon buttons so the DOM is `<button><svg/></button>`.
 */
export const useApplyIcon = (
  el: Ref<HTMLElement | null | undefined>,
  icon: () => string,
) => {
  const sync = () => applyIcon(el.value, icon())
  onMounted(sync)
  watch([el, () => icon()], sync)
}
