import { describe, expect, it } from 'vitest'
import { splitSentences } from '../src/ai/splitSentences'

describe('splitSentences', () => {
  it('keeps the ending punctuation and drops the following space', () => {
    expect(splitSentences('Hello. World!')).toEqual(['Hello.', 'World!'])
    expect(splitSentences('你好。世界！')).toEqual(['你好。', '世界！'])
  })

  it('keeps a tail that has no sentence punctuation', () => {
    expect(splitSentences('Wait. And then')).toEqual(['Wait.', 'And then'])
    expect(splitSentences('No punctuation here')).toEqual(['No punctuation here'])
  })

  it('returns nothing for blank text', () => {
    expect(splitSentences('   ')).toEqual([])
  })
})
