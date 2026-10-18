import { getAiRuntime } from '../runtime'
import { LlmClient } from './LlmClient'
import { LlmModelProvider } from './LlmModelProvider'

export type Llm = {
  client: LlmClient
  modelProvider: LlmModelProvider
}

let cached: Llm | null = null

export const getLlm = (): Llm => {
  if (!cached) {
    getAiRuntime()
    const modelProvider = new LlmModelProvider()
    cached = { client: new LlmClient(modelProvider), modelProvider }
  }
  return cached
}

export const resetLlm = () => {
  cached = null
}

export {
  DefaultOfficialModelName,
  DefaultOfficialPlatformId,
} from './types'
export type {
  LlmCompleteCallbacks,
  LlmCompleteRequest,
  LlmMessage,
  LlmModel,
  LlmSetting,
  LlmToolCall,
  LlmToolDefinition,
} from './types'
