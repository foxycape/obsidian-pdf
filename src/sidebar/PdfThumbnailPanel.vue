<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Reader } from '@core/kernal'
import { getCustomPdfRenderer } from '@/chrome/usePdfRenderer'
import { PdfRenderingQueue } from './thumbnail/PdfRenderingQueue'
import { PdfThumbnailViewer } from './thumbnail/PdfThumbnailViewer'

const props = withDefaults(
  defineProps<{
    reader: Reader
    active?: boolean
  }>(),
  { active: false },
)

const containerRef = ref<HTMLDivElement | null>(null)
let thumbnailViewer: PdfThumbnailViewer | null = null
let renderingQueue: PdfRenderingQueue | null = null

const initThumbnailViewer = async () => {
  if (!containerRef.value) {
    return
  }
  const renderer = getCustomPdfRenderer(props.reader)
  if (!renderer?.getPdfViewer) {
    return
  }

  const pdfViewer = renderer.getPdfViewer()
  const eventBus = renderer.getEventBus()
  const linkService = renderer.getLinkService()
  if (!pdfViewer || !eventBus || !linkService) {
    return
  }

  if (!renderingQueue) {
    // Dedicated thumbnail queue — do not share with the main viewer so
    // visible-area thumbnails are not starved by main-page pre-render.
    renderingQueue = new PdfRenderingQueue()
  }

  if (!thumbnailViewer) {
    thumbnailViewer = new PdfThumbnailViewer(
      containerRef.value,
      eventBus,
      linkService,
      renderingQueue,
    )
    renderingQueue.setThumbnailViewer(thumbnailViewer)
    renderingQueue.isThumbnailViewEnabled = true
    renderingQueue.preferThumbnails = true
  }

  const pdfDocument = renderer.getPdfDocument()
  if (pdfDocument && thumbnailViewer) {
    thumbnailViewer.setDocument(pdfDocument)
    await thumbnailViewer.updatePageLabels()
    setTimeout(() => {
      renderingQueue?.renderHighestPriority()
    }, 200)
  }
}

onMounted(() => {
  setTimeout(() => {
    void initThumbnailViewer()
  }, 100)
})

watch(
  () => props.active,
  (active) => {
    if (renderingQueue) {
      renderingQueue.preferThumbnails = active
      renderingQueue.isThumbnailViewEnabled = active
    }
    if (!active || !thumbnailViewer) {
      return
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        renderingQueue?.renderHighestPriority()
      }, 50)
    })
  },
)

onBeforeUnmount(() => {
  thumbnailViewer?.cleanup()
  thumbnailViewer = null
  renderingQueue?.cleanup()
  renderingQueue = null
})
</script>

<template>
  <div ref="containerRef" class="foxycape-pdf-thumbnail-viewer" />
</template>

<style scoped>
.foxycape-pdf-thumbnail-viewer {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 8px;
  text-align: center;
}

:deep(.thumbnailView) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

:deep(.thumbnail) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  overflow: visible;
  transition: all 0.2s;
  cursor: pointer;
  padding: 4px;
  margin-block-end: 15px;
  width: fit-content;
  margin-inline: 6px;
  color: inherit;
}

:deep(.thumbnail:hover),
:deep(.thumbnail.active) {
  border-color: var(--interactive-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

:deep(.thumbnailSelectionRing) {
  display: inline-block;
  background: var(--background-primary);
}

:deep(.thumbnailSelectionRing canvas) {
  display: block;
  max-width: 100%;
  height: auto;
}

:deep(.thumbnail-page-label) {
  text-align: center;
  margin-block-start: 4px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
