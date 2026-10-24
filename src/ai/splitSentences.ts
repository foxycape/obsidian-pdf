const SENTENCE_END = '。！？.!?'

/** Split after sentence punctuation without a lookbehind (unsupported before iOS 16.4). */
export const splitSentences = (text: string): string[] => {
  const sentences: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (!SENTENCE_END.includes(text[index] ?? '')) {
      continue
    }
    let next = index + 1
    while (next < text.length && /\s/.test(text[next] ?? '')) {
      next += 1
    }
    const sentence = text.slice(start, index + 1).trim()
    if (sentence) {
      sentences.push(sentence)
    }
    start = next
    index = next - 1
  }
  const tail = text.slice(start).trim()
  if (tail) {
    sentences.push(tail)
  }
  return sentences
}
