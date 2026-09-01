import { describe, expect, it } from 'vitest'
import type { Mark } from '@foxycape/core/kernal/mark/Mark'
import { hydrateLegacyMark } from '@/marker/hydrateLegacyMark'

const baseMark = {
  markId: 'm1',
  resourceId: 'book-1',
  type: 'drawline',
  text: 'hello',
  styleName: 'mark_pen',
  contentRange: {
    kind: 'fixed' as const,
    geometries: [
      {
        pageNumber: 3,
        width: 100,
        height: 100,
        shape: 'rect' as const,
        coords: [1, 2, 3, 4],
        rotation: 0,
      },
    ],
  },
}

describe('hydrateLegacyMark', () => {
  it('fills pageNumber from geometries', () => {
    const mark = hydrateLegacyMark({
      ...baseMark,
      createdAt: 1,
      updatedAt: 2,
    } as Mark)
    expect(mark.pageNumber).toBe(3)
  })

  it('migrates ISO createTime/updateTime to epoch createdAt/updatedAt', () => {
    const mark = hydrateLegacyMark({
      ...baseMark,
      createTime: '2026-01-01T00:00:00.000Z',
      updateTime: '2026-01-03T00:00:00.000Z',
      notes: [
        {
          id: 'n1',
          content: 'note',
          createTime: '2026-01-02T00:00:00.000Z',
          updateTime: '2026-01-02T12:00:00.000Z',
        },
      ],
    } as unknown as Mark)

    expect(mark.createdAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'))
    expect(mark.updatedAt).toBe(Date.parse('2026-01-03T00:00:00.000Z'))
    expect((mark as { createTime?: unknown }).createTime).toBeUndefined()
    expect((mark as { updateTime?: unknown }).updateTime).toBeUndefined()
    expect(mark.notes?.[0].createdAt).toBe(Date.parse('2026-01-02T00:00:00.000Z'))
    expect(mark.notes?.[0].updatedAt).toBe(Date.parse('2026-01-02T12:00:00.000Z'))
    expect((mark.notes?.[0] as { createTime?: unknown }).createTime).toBeUndefined()
  })

  it('keeps already-numeric createdAt/updatedAt', () => {
    const mark = hydrateLegacyMark({
      ...baseMark,
      createdAt: 10,
      updatedAt: 20,
    } as Mark)
    expect(mark.createdAt).toBe(10)
    expect(mark.updatedAt).toBe(20)
  })
})
