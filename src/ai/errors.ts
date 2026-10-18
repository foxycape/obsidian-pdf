export type AiErrorCode = 'license-required' | 'no-ai-token' | 'no-ai-provider'

export class AiAccessError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AiAccessError'
  }
}
