import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import OpenAI from 'openai'
import { AiAccessError } from '../errors'
import { createObsidianAiFetch } from '../fetch'
import { getAiRuntime } from '../runtime'
import { emitInuseModelChange } from './inuseModelChange'
import {
  DefaultOfficialModelName,
  DefaultOfficialPlatformId,
  type LlmModel,
  type LlmSetting,
} from './types'

const LLM_MODELS_TABLE = 'llm-models'
const INUSE_KEY = 'inuse'

type InUseRecord = {
  platformId: string
  model: string
}

const officialRecord = (): InUseRecord => ({
  platformId: DefaultOfficialPlatformId,
  model: DefaultOfficialModelName,
})

const cloneSetting = (setting: LlmSetting): LlmSetting => ({
  id: setting.id,
  platform: setting.platform,
  models: (setting.models ?? []).map((model) => ({ ...model })),
  baseUrl: setting.baseUrl,
  apiKey: setting.apiKey,
  isOfficial: setting.isOfficial,
})

const officialSetting = (inUse: boolean): LlmSetting => ({
  id: DefaultOfficialPlatformId,
  isOfficial: true,
  platform: 'Official',
  baseUrl: '',
  models: [
    {
      isOfficial: true,
      name: DefaultOfficialModelName,
      title: 'Official model',
      isInUse: inUse,
    },
  ],
})

const stampInUse = (settings: LlmSetting[], inuse: InUseRecord) => {
  for (const setting of settings) {
    for (const model of setting.models) {
      model.isInUse = setting.id === inuse.platformId && model.name === inuse.model
    }
  }
}

export class LlmModelProvider {
  addSetting = async (setting: LlmSetting): Promise<LlmSetting> => {
    const next = cloneSetting(setting)
    if (!next.id) {
      next.id = getRandomId()
    }
    if (!next.baseUrl?.trim()) {
      throw new Error('Missing baseUrl')
    }
    if (!next.platform?.trim()) {
      throw new Error('Missing platform name')
    }
    next.isOfficial = false
    next.models = next.models ?? []
    await getAiRuntime().storage.set(LLM_MODELS_TABLE, next.id, next)
    return next
  }

  updateSetting = async (setting: LlmSetting): Promise<void> => {
    if (!setting.id || setting.isOfficial || setting.id === DefaultOfficialPlatformId) {
      return
    }
    await getAiRuntime().storage.set(LLM_MODELS_TABLE, setting.id, cloneSetting(setting))
  }

  addModel = async (platformId: string, model: LlmModel): Promise<void> => {
    const settings = await this.getSettings(true)
    const setting = settings.find((item) => item.id === platformId)
    if (!setting) {
      return
    }
    const name = model.name.trim()
    if (!name) {
      return
    }
    const existing = setting.models.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      existing.title = model.title?.trim() || existing.title
    } else {
      setting.models.push({ name, title: model.title?.trim() || name })
    }
    await this.updateSetting(setting)
  }

  removeModel = async (settingId: string, model: string): Promise<void> => {
    const settings = await this.getSettings(true)
    const setting = settings.find((item) => item.id === settingId)
    if (!setting || setting.isOfficial) {
      return
    }
    setting.models = setting.models.filter((item) => item.name !== model)
    await this.updateSetting(setting)
    const inuse = await this.readInUse()
    if (inuse?.platformId === settingId && inuse.model === model) {
      await this.clearInUse(true)
    }
  }

  removeSetting = async (settingId: string): Promise<boolean> => {
    if (!settingId || settingId === DefaultOfficialPlatformId) {
      return false
    }
    const exist = await getAiRuntime().storage.get<LlmSetting>(LLM_MODELS_TABLE, settingId)
    if (!exist) {
      return false
    }
    await getAiRuntime().storage.delete(LLM_MODELS_TABLE, settingId)
    const inuse = await this.readInUse()
    if (inuse?.platformId === settingId) {
      await this.clearInUse(true)
    }
    return true
  }

  getSettings = async (custom?: boolean): Promise<LlmSetting[]> => {
    const customSettings = await this.loadCustomSettings()
    if (custom) {
      return customSettings
    }
    const inuse = await this.resolveInUse(customSettings)
    const settings = [officialSetting(inuse.platformId === DefaultOfficialPlatformId), ...customSettings]
    stampInUse(settings, inuse)
    return settings
  }

  setInUseModel = async (platformId: string, model: string): Promise<void> => {
    const settings = await this.getSettings()
    const setting = settings.find((item) => item.id === platformId)
    if (!setting) {
      throw new AiAccessError('no-ai-provider', 'Not found ai platform: ' + (platformId ?? ''))
    }
    const found = setting.models.find((item) => item.name === model)
    if (!found) {
      throw new Error('Not found model: ' + model)
    }
    const next = { platformId, model: found.name }
    await getAiRuntime().storage.set<InUseRecord>(LLM_MODELS_TABLE, INUSE_KEY, next)
    emitInuseModelChange(next)
  }

  getInuseModel = async (): Promise<{ platformId: string; model: string }> => {
    const customSettings = await this.loadCustomSettings()
    return this.resolveInUse(customSettings)
  }

  listModels = async (baseUrl: string, apiKey: string): Promise<LlmModel[]> => {
    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      dangerouslyAllowBrowser: true,
      timeout: 8000,
      maxRetries: 0,
      fetch: getAiRuntime().fetchImpl ?? createObsidianAiFetch(),
    })
    const page = await openai.models.list()
    return (page.data ?? [])
      .map((item) => ({ name: item.id, title: item.id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private loadCustomSettings = async (): Promise<LlmSetting[]> => {
    const settingMap = await getAiRuntime().storage.getAll<LlmSetting>(LLM_MODELS_TABLE)
    const customSettings: LlmSetting[] = []
    for (const [key, item] of settingMap) {
      if (!item || key === INUSE_KEY || item.isOfficial || item.id === DefaultOfficialPlatformId) {
        continue
      }
      customSettings.push(cloneSetting(item))
    }
    return customSettings
  }

  private readInUse = async (): Promise<InUseRecord | null> => {
    const stored = await getAiRuntime().storage.get<InUseRecord>(LLM_MODELS_TABLE, INUSE_KEY)
    if (!stored?.platformId || !stored.model) {
      return null
    }
    return { platformId: stored.platformId, model: stored.model }
  }

  /** Drop a selection that points at a platform or model that no longer exists. */
  private resolveInUse = async (customSettings: LlmSetting[]): Promise<InUseRecord> => {
    const stored = await this.readInUse()
    if (!stored || stored.platformId === DefaultOfficialPlatformId) {
      return officialRecord()
    }
    const setting = customSettings.find((item) => item.id === stored.platformId)
    const model = setting?.models.find((item) => item.name === stored.model)
    if (!setting || !model) {
      await this.clearInUse(false)
      return officialRecord()
    }
    return stored
  }

  private clearInUse = async (notify: boolean) => {
    await getAiRuntime().storage.delete(LLM_MODELS_TABLE, INUSE_KEY)
    if (notify) {
      emitInuseModelChange(officialRecord())
    }
  }
}
