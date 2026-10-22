import '@/styles/pdf-view.css'
import '@/styles/pdf-ai-chrome.css'

// The reader, Dexie, the hash worker, and KaTeX fonts load from reader-bundle.zip the first time a PDF opens.
import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
