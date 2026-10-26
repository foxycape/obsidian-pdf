/** Wrap bare LaTeX so the existing Markdown math renderer can display it. */
export const toFormulaMarkdown = (latex: string): string => {
  const trimmed = latex.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.includes('$$') || trimmed.includes('\\(') || trimmed.includes('\\[')) {
    return trimmed
  }
  if (/\$[^$\n]+\$/.test(trimmed)) {
    return trimmed
  }
  return `$$\n${trimmed}\n$$`
}
