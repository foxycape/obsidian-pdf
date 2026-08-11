import {
  DEFAULT_PDF_VIEW_PREFERENCES,
  type PdfViewPreferences,
} from '@/reader/mediaTypes/pdf/CustomPdfOptions'

export type {
  PdfThemeColorRemapMode,
  PdfViewPreferencePatch,
  PdfViewPreferences,
} from '@/reader/mediaTypes/pdf/CustomPdfOptions'

/**
 * Persisted Obsidian plugin data.
 * PDF view preference fields are owned by CustomPdfOptions — do not redefine them here.
 */
export type FoxycapePdfSettings = {
  /** When true, clicking .pdf opens Foxycape instead of the built-in viewer. */
  useAsDefaultPdfViewer: boolean
  /** User-entered license key (empty when not purchased). */
  license: string
  /** Epoch ms when the 7-day trial started; 0 means not started yet. */
  trialStartedAt: number
  /** Last known server-validated license status. */
  licenseValid: boolean
  /** Whether the validated license is lifetime (vs subscription). */
  licenseLifetime: boolean
  /** Epoch ms of the last successful or definitive license check. */
  lastLicenseCheckAt: number
} & PdfViewPreferences

export const DEFAULT_SETTINGS: FoxycapePdfSettings = {
  useAsDefaultPdfViewer: false,
  license: '',
  trialStartedAt: 0,
  licenseValid: false,
  licenseLifetime: false,
  lastLicenseCheckAt: 0,
  ...DEFAULT_PDF_VIEW_PREFERENCES,
}

/** Persist only values that differ from defaults so code default changes apply to unset users. */
export const toPersistedSettings = (
  settings: FoxycapePdfSettings,
): Partial<FoxycapePdfSettings> => {
  const persisted: Partial<FoxycapePdfSettings> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof FoxycapePdfSettings)[]) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) {
      // Assign via index — value type is a union of setting fields.
      ;(persisted as Record<string, unknown>)[key] = settings[key]
    }
  }
  return persisted
}

/** Built-in Obsidian PDF view type id. */
export const OBSIDIAN_PDF_VIEW_TYPE = 'pdf'

/** Foxycape PDF reader view type id. */
export const PDF_READER_VIEW_TYPE = 'foxycape-pdf'
