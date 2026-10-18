import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'

export type TranslateEngine = 'edgemt' | 'ai'

export type TranslateRecord = {
  engine: TranslateEngine
  languageCode: string
  translatedText: string
  updatedAt: number
}

export type TranslateMark = {
  markId: string
  simpleId: string
  text: string
  url: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  results: TranslateRecord[]
  createdAt: number
  updatedAt: number
  ownerId?: string
}

export type ExplainDetail = 'brief' | 'detailed'

export type ExplainRecord = {
  id: string
  detail: ExplainDetail
  explanation: string
  updatedAt: number
}

export type ExplainMark = {
  markId: string
  simpleId: string
  text: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  results: ExplainRecord[]
  createdAt: number
  updatedAt: number
  ownerId?: string
}

export type LookupRecord = {
  id: string
  detail: ExplainDetail
  lookup: string
  updatedAt: number
}

export type LookupMark = {
  markId: string
  simpleId: string
  text: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
  results: LookupRecord[]
  createdAt: number
  updatedAt: number
  ownerId?: string
}

export type PassageRef = {
  markId: string
  simpleId: string
  text: string
  pageNumber?: number
  navUrl?: string
  navTitle?: string
  contentRange?: FixedContentRange
}
