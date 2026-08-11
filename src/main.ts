import '@/styles/pdf-view.css'

// Foxycape pdf_viewer + pdf.mjs use private globals (__foxycapePdfjs*).
// Worker: dist/pdfjs/pdf.worker.min.mjs → Blob URL at open time.
import '@/reader/foxycapePdfViewer'

import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
