const REPLACEABLE_VERDICTS = new Set(['ok', 'likely_error', 'needs_user_confirm'])

/** ok、likely_error、needs_user_confirm 可以用建议文本替换识别结果。 */
export const canApplyReviewedText = (verdict: string): boolean =>
  REPLACEABLE_VERDICTS.has(verdict.trim().toLowerCase())
