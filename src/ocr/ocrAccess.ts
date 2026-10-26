import type { IApiClient } from '@/network'
import { AiAccessError } from '@/ai/errors'
import { getLicenseAiUser } from '@/ai/licenseSession'
import { tryGetAiRuntime } from '@/ai/runtime'

/** Official OCR uses the license access token, including when a custom chat model is selected. */
export const requireOcrAccessToken = async (apiClient: IApiClient): Promise<string> => {
  const runtime = tryGetAiRuntime()
  const license = runtime?.getLicense().trim() ?? ''
  if (!runtime || !license) {
    throw new AiAccessError('license-required', 'A license is required for OCR')
  }
  const user = await getLicenseAiUser(apiClient, license)
  if (!user?.accessToken) {
    throw new AiAccessError('license-required', 'A license is required for OCR')
  }
  if (user.availableAITokenCount === 0) {
    throw new AiAccessError('no-ai-token', 'Official AI quota used up')
  }
  return user.accessToken
}
