import { DefaultOfficialPlatformId, getLlm } from './index'

type Translate = (key: string, fallback: string) => string

/** Official models show the translated label; custom models show their display name. */
export const resolveInuseModelLabel = async (t: Translate): Promise<string> => {
  const llm = getLlm()
  const inuse = await llm.modelProvider.getInuseModel()
  const settings = await llm.modelProvider.getSettings()
  const platform = settings.find((item) => item.id === inuse.platformId)
  const model = platform?.models.find((item) => item.name === inuse.model)
  const isOfficial =
    platform?.isOfficial
    || platform?.id === DefaultOfficialPlatformId
    || inuse.platformId === DefaultOfficialPlatformId
  if (isOfficial) {
    return t('ai_official_model', 'Official model')
  }
  return model?.title || inuse.model || ''
}
