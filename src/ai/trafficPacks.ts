import { VIP_SEARCH_PATH } from '@/license/constants'
import type { IApiClient } from '@/network'

export type AiTrafficPack = {
  title: string
  tokenCount: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readTokenCount = (sku: Record<string, unknown>): number => {
  const raw = sku.includesAITokenCount ?? sku.includesAiTokenCount
  return typeof raw === 'number' && raw > 0 ? raw : 0
}

/** On-shelf AI traffic packs (`goodsType=6`). Empty when none are for sale. */
export const loadAiTrafficPacks = async (apiClient: IApiClient): Promise<AiTrafficPack[]> => {
  const locale = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-cn' : 'en-us'
  try {
    const raw = await apiClient.get(
      VIP_SEARCH_PATH,
      { LocaleLanguge: locale, goodsType: 6, ps: 20, cp: 1 },
      true,
    )
    const data = isRecord(raw) && isRecord(raw.data) ? raw.data : null
    const items = Array.isArray(data?.itemList) ? data.itemList : []
    const packs: AiTrafficPack[] = []
    for (const item of items) {
      if (!isRecord(item)) {
        continue
      }
      const skus = Array.isArray(item.skus) ? item.skus : []
      for (const sku of skus) {
        if (!isRecord(sku)) {
          continue
        }
        const tokenCount = readTokenCount(sku)
        if (tokenCount <= 0) {
          continue
        }
        const title = typeof sku.title === 'string' && sku.title.trim()
          ? sku.title.trim()
          : typeof item.title === 'string'
            ? item.title.trim()
            : ''
        if (!title) {
          continue
        }
        packs.push({ title, tokenCount })
      }
    }
    return packs
  } catch {
    return []
  }
}
