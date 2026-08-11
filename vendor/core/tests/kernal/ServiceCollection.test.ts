import { describe, expect, it } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { DefaultLocale } from '@/kernal/i18n/DefaultLocale'
import { ReaderInfo } from '@/kernal/ReaderInfo'
import { CoreServiceMap, ServiceCollection, ServiceMap } from '@/kernal/services/ServiceCollection'

describe('ServiceCollection core/ui split', () => {
  const createCollection = <TMap extends CoreServiceMap = ServiceMap>() =>
    new ServiceCollection<TMap>(
      new DefaultLocale(),
      new EventEmitter(),
      new ReaderInfo('1.0.0', '', '', false)
    )

  it('registerCoreServices does not register UI services', () => {
    const services = createCollection<CoreServiceMap>()
    services.registerCoreServices()

    expect(services.has('httpClient')).toBe(true)
    expect(services.has('crypto')).toBe(true)
    expect(services.has('notifier' as keyof CoreServiceMap)).toBe(false)
  })

  it('registerUiServices adds notifier and loading on reader map', () => {
    const services = createCollection<ServiceMap>()
    services.registerCoreServices()
    services.registerUiServices()

    expect(services.has('notifier')).toBe(true)
    expect(services.has('loading')).toBe(true)
  })

  it('asReaderServices returns the same instance', () => {
    const core = createCollection<CoreServiceMap>()
    const reader = core.asReaderServices()
    expect(reader).toBe(core)
  })
})
