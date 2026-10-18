import { DefaultOfficialPlatformId, getLlm } from './llm'
import { getLicenseAiUser } from './licenseSession'
import { getAiRuntime } from './runtime'

export type AiAccessMode = 'need-license' | 'quota'

/**
 * Official-model gate used before explain, lookup, ask AI, and AI translation.
 * A custom platform that already has a key skips the dialog, matching reader.
 */
export const resolveAiAccessChoice = async (): Promise<AiAccessMode | null> => {
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  if (inuse.platformId !== DefaultOfficialPlatformId) {
    const settings = await llm.modelProvider.getSettings()
    const setting = settings.find((item) => item.id === inuse.platformId)
    if (setting && !setting.isOfficial && setting.apiKey?.trim() && setting.baseUrl?.trim()) {
      return null
    }
  }
  const runtime = getAiRuntime()
  const license = runtime.getLicense().trim()
  if (!license) {
    return 'need-license'
  }
  const user = await getLicenseAiUser(runtime.apiClient, license)
  if (!user?.accessToken) {
    return 'need-license'
  }
  if (user.availableAITokenCount === 0) {
    return 'quota'
  }
  return null
}
