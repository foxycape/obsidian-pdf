import { describe, expect, it } from 'vitest'
import { AiAccessError } from '../src/ai/errors'
import { requireApiData } from '../src/ocr/apiResult'
import { toFormulaMarkdown } from '../src/ocr/formulaMarkdown'
import { buildMultipartBody } from '../src/ocr/multipartBody'
import { sanitizeTableHtml, tableHtmlToMarkdown } from '../src/ocr/tableHtml'
import { canApplyReviewedText } from '../src/ocr/reviewNote'
import { collectReviewReference, sliceTextWindow } from '../src/ocr/reviewContext'
import { ResponseCode } from '../src/network/ApiConstants'

describe('region OCR helpers', () => {
  it('reads a successful payload and rejects quota errors', () => {
    expect(requireApiData({ success: true, data: { text: 'hello' } })).toEqual({ text: 'hello' })
    expect(() => requireApiData({ success: false, code: ResponseCode.OutofAvailableAITokenCount })).toThrow(
      AiAccessError,
    )
  })

  it('wraps bare latex and leaves delimited formulas alone', () => {
    expect(toFormulaMarkdown('E=mc^2')).toBe('$$\nE=mc^2\n$$')
    expect(toFormulaMarkdown('$$E=mc^2$$')).toBe('$$E=mc^2$$')
  })

  it('turns a table into markdown and drops scripts', () => {
    const html = '<table><tr><th>A</th><td>1</td></tr><tr><td><script>alert(1)</script>B</td><td>2</td></tr></table>'
    expect(tableHtmlToMarkdown(html)).toBe('| A | 1 |\n| --- | --- |\n| B | 2 |')
    expect(sanitizeTableHtml(html)).not.toContain('script')
    expect(sanitizeTableHtml(html)).toContain('>B<')
  })

  it('puts the file part last in the multipart body', async () => {
    const body = new TextDecoder().decode(
      await buildMultipartBody(
        { policy: 'abc' },
        { fieldName: 'file', fileName: 'crop.png', blob: new Blob(['png']) },
        'bound',
      ),
    )
    expect(body.indexOf('name="policy"')).toBeLessThan(body.indexOf('name="file"'))
    expect(body).toContain('filename="crop.png"')
    expect(body.endsWith('--bound--\r\n')).toBe(true)
  })

  it('replaces ok, likely_error, and needs_user_confirm, and rejects proofreading failures', () => {
    expect(canApplyReviewedText('ok')).toBe(true)
    expect(canApplyReviewedText('OK')).toBe(true)
    expect(canApplyReviewedText('likely_error')).toBe(true)
    expect(canApplyReviewedText('needs_user_confirm')).toBe(true)
    expect(canApplyReviewedText('error')).toBe(false)
    expect(canApplyReviewedText('irreparable')).toBe(false)
    expect(canApplyReviewedText('unknown')).toBe(false)
  })

  it('keeps 250 characters around the cropped text and stops at the page ends', () => {
    const page = `${'前'.repeat(400)}中${'后'.repeat(400)}`
    expect(sliceTextWindow(page, 400, 401, 250)).toBe(`${'前'.repeat(250)}中${'后'.repeat(250)}`)
    expect(sliceTextWindow(page, 0, 2, 250)).toBe(page.slice(0, 252))
    expect(sliceTextWindow(page, page.length - 3, page.length, 250)).toBe(page.slice(page.length - 253))

    const reference = collectReviewReference(
      [
        { str: '前'.repeat(10), transform: [1, 0, 0, 1, 0, 0], width: 10, height: 10 },
        { str: '中', transform: [1, 0, 0, 1, 20, 0], width: 10, height: 10 },
        { str: '后'.repeat(10), transform: [1, 0, 0, 1, 40, 0], width: 10, height: 10 },
      ],
      { left: 20, bottom: 0, right: 30, top: 10 },
      4,
    )
    expect(reference).toBe(`${'前'.repeat(4)}中${'后'.repeat(4)}`)
  })
})
