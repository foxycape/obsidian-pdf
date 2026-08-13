import '@/styles/pdf-view.css'

// Foxycape pdf_viewer + pdf.mjs use private globals (__foxycapePdfjs*).
// Worker: pluginDir/pdfjs/pdf.worker.min.mjs → Blob URL at open time
// (unpacked from main.js; cmaps/fonts download in the background).
import '@/reader/foxycapePdfViewer'

import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
