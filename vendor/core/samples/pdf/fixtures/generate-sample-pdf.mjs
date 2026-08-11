import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pages = [
  [
    'PDF Sample',
    'Foxycape PDF loading test',
    'Page 1 / 3',
    'Use toolbar controls to change scroll, spread, zoom and page.',
  ],
  [
    'Second Page',
    'Double-page / book spread can be tested here.',
    'Page 2 / 3',
    'Try zooming with mouse wheel while Ctrl is pressed.',
  ],
  [
    'Third Page',
    'Rotate and navigate with the sample controls.',
    'Page 3 / 3',
    'Open a local PDF via the file picker as well.',
  ],
]

const escapePdfText = (text) =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const objects = []
const add = (content) => {
  objects.push(content)
  return objects.length
}

const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
const pageRefs = []

for (const [title, line1, line2, line3] of pages) {
  const stream = [
    'BT',
    '/F1 28 Tf',
    '50 760 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 16 Tf',
    '0 -40 Td',
    `(${escapePdfText(line1)}) Tj`,
    '0 -28 Td',
    `(${escapePdfText(line2)}) Tj`,
    '0 -28 Td',
    `(${escapePdfText(line3)}) Tj`,
    'ET',
  ].join('\n')
  const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  const pageId = add('') // placeholder
  pageRefs.push({ pageId, contentId })
}

const pagesId = add('') // placeholder
for (const { pageId, contentId } of pageRefs) {
  objects[pageId - 1] =
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
}
objects[pagesId - 1] =
  `<< /Type /Pages /Kids [${pageRefs.map((p) => `${p.pageId} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`

const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

let pdf = '%PDF-1.4\n'
const offsets = [0]
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(pdf))
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
}
const xrefPos = Buffer.byteLength(pdf)
pdf += `xref\n0 ${objects.length + 1}\n`
pdf += '0000000000 65535 f \n'
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`
pdf += `startxref\n${xrefPos}\n%%EOF\n`

const out = path.join(__dirname, 'sample.pdf')
fs.writeFileSync(out, pdf)
console.log(`wrote ${out} (${Buffer.byteLength(pdf)} bytes)`)
