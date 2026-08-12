import '@/styles/pdf-view.css'

// Foxycape pdf_viewer + pdf.mjs use private globals (__foxycapePdfjs*).
// Worker: pluginDir/pdfjs/pdf.worker.min.mjs → Blob URL at open time
// (downloaded once with cmaps/fonts/signer if missing).
import '@/reader/foxycapePdfViewer'

import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
