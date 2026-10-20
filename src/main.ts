import '@/styles/pdf-view.css'
import '@/styles/pdf-ai-chrome.css'

// Reader and AI live in pdf.js, loaded the first time a PDF opens.
import { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export default FoxycapePdfPlugin
