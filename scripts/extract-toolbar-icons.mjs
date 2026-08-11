import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.resolve(
  'e:/tiefeiying/linghuxiong/reader/default/src/assets/icons/iconfont.js',
)
const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/chrome/mark/toolbar-icons.svg',
)

const ids = [
  'icon-copy_line',
  'icon-font_line',
  'icon-font-wavy',
  'icon-font-color',
  'icon-magic',
  'icon-more-2-fill',
  'icon-more',
  'icon-check-line',
  'icon-format-clear',
]

const raw = fs.readFileSync(src, 'utf8')
const prefix = "window._iconfont_svg_string_"
const prefixAt = raw.indexOf(prefix)
if (prefixAt < 0) throw new Error('prefix not found')
const eqAt = raw.indexOf("='", prefixAt)
const start = eqAt + 2
let end = -1
for (let p = start; p < raw.length; p++) {
  if (raw[p] === '\\') {
    p++
    continue
  }
  if (raw[p] === "'") {
    end = p
    break
  }
}
if (end < 0) throw new Error('closing quote not found')

const svgInner = raw
  .slice(start, end)
  .replace(/\\'/g, "'")
  .replace(/\\"/g, '"')
  .replace(/\\\\/g, '\\')

console.log('svg length', svgInner.length)

const symbols = []
for (const id of ids) {
  const re = new RegExp(`<symbol id="${id}"[\\s\\S]*?<\\/symbol>`)
  const found = svgInner.match(re)
  console.log(id, found ? 'OK' : 'MISSING')
  if (found) symbols.push(found[0])
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>\n`
fs.writeFileSync(out, sprite, 'utf8')
console.log('wrote', out, 'bytes', sprite.length)
