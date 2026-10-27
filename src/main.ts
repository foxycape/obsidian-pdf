import 'katex/dist/katex.min.css'
import '@/styles/pdf-view.css'
import '@/styles/pdf-ai-chrome.css'

// The reader, Dexie, and the hash worker load from reader-bundle.zip the first time a PDF opens.
// KaTeX CSS, including embedded woff2, is part of styles.css.
import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
