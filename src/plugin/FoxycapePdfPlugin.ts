import { Notice, Plugin, TFile } from 'obsidian'
import type { IDevice } from '@foxycape/core/kernal'
import type { IApiClient } from '@/network'
import { createPluginApiClient } from '@/api/createPluginApiClient'
import { DeviceService } from '@/api/DeviceService'
import {
  ensureEmbeddedRuntimeAssets as unpackEmbeddedRuntimeAssets,
  ensureRemoteRuntimeAssets,
  ensureRuntimeAssets as unpackRuntimeAssets,
  hasEmbeddedRuntimeAssets,
} from '@/assets/ensureRuntimeAssets'
import { ObsidianLocale } from '@/i18n'
import { LicenseService } from '@/license'
import { installPdfImageRefContextMenu } from '@/obsidian/installPdfImageRefContextMenu'
import { installPdfImageRefPaste } from '@/obsidian/installPdfImageRefPaste'
import { installRemotePdfLinkOpen } from '@/obsidian/installRemotePdfLinkOpen'
import { normalizeRemoteDocumentUrl } from '@/obsidian/remotePdfLink'
import {
  consumePendingPdfLinkSubpath,
  findExistingPdfLeaf,
  installPdfLinkContextCapture,
  installPdfLinkReuse,
  normalizePdfSubpath,
  revealExistingPdfLeaf,
} from '@/obsidian/reusePdfLeaf'
import { FoxycapePdfSettingTab } from '@/settings/FoxycapePdfSettingTab'
import type { PdfViewPreferencePatch } from '@/reader/mediaTypes/pdf/CustomPdfOptions'
import {
  DEFAULT_SETTINGS,
  OBSIDIAN_PDF_VIEW_TYPE,
  toPersistedSettings,
  type FoxycapePdfSettings,
} from '@/settings/types'
import { disposeWasmSignerBlobUrl } from '@/api/resolveWasmSignerUrl'
import { disposePdfWorkerBlobSrc } from '@/reader/pdfAssets'
import { DexieStorage } from '@/storage'
import { applyFoxycapeMenuIcon, registerFoxycapeIcon } from '@/ui/foxycapeIcon'
import { showLicenseRequiredModal } from '@/ui/LicenseRequiredModal'
import { PDF_READER_VIEW_TYPE, PdfReaderView } from '@/views/PdfReaderView'

type ViewRegistryLike = {
  registerExtensions?: (extensions: string[], viewType: string) => void
  unregisterExtensions?: (extensions: string[]) => void
}

export class FoxycapePdfPlugin extends Plugin {
  settings: FoxycapePdfSettings = { ...DEFAULT_SETTINGS }
  locale = new ObsidianLocale(this)
  /** Shared IndexedDB storage for marks / progress (injected into core Reader). */
  storage = new DexieStorage({ dbName: 'foxycape-pdf' })
  /** Shared signed API client (IApiClient + ObsidianHttpClient/requestUrl). */
  apiClient!: IApiClient
  /** Shared device identity used by API signing + registration. */
  device!: IDevice
  deviceService!: DeviceService
  licenseService!: LicenseService
  /**
   * Set while Obsidian builds an internal-link context menu so right-click
   * "Open with Foxycape PDF" can keep `#page=` / `#selection=` / `#markId=`.
   */
  pendingPdfLink: { linktext: string; sourcePath: string } | null = null
  /** Image-ref right-click: PDF target captured from the first ancestor with `src`. */
  pendingPdfImageRefTarget: {
    target: { pdfFile: TFile; subpath: string }
    imageFileName: string
  } | null = null
  /** Prevent stacking multiple trial-ended dialogs. */
  private isLicenseModalOpen = false
  private isDefaultPdfBindingActive = false
  private lastSyncedLanguage = ''

  async onload() {
    await this.loadSettings()
    const api = createPluginApiClient(this, {
      appId: '20',
      appVersion: this.manifest.version,
    })
    this.apiClient = api.apiClient
    this.device = api.device
    this.deviceService = new DeviceService(this, this.device)
    this.licenseService = new LicenseService(this)
    await this.locale.initialize()
    this.lastSyncedLanguage = this.locale.getCurrentLanguage()
    registerFoxycapeIcon()

    await this.licenseService.ensureTrialStarted()
    // Unpack worker+signer from main.js, then register device / validate license.
    // Cmaps/fonts download silently in the background.
    void this.bootstrapRuntimeAssets()
    this.licenseService.startPeriodicValidation()

    this.registerView(
      PDF_READER_VIEW_TYPE,
      (leaf) => new PdfReaderView(leaf, this),
    )

    // Capture linktext (with subpath) for link context menus; reuse open tabs on click.
    installPdfLinkContextCapture(this)
    installPdfLinkReuse(this)
    installPdfImageRefPaste(this)
    installPdfImageRefContextMenu(this)
    installRemotePdfLinkOpen(this)

    this.addCommand({
      id: 'open-with-reader',
      name: this.t('plugin_command_open_with', 'Open with Foxycape PDF'),
      checkCallback: (checking) => {
        const file = this.getActivePdfFile()
        if (!file) {
          return false
        }
        if (!checking) {
          void this.openFileWithFoxycape(file)
        }
        return true
      },
    })

    this.addCommand({
      id: 'open-pdf-view',
      name: this.t('plugin_command_open_view', 'Open Foxycape PDF view'),
      callback: () => {
        const file = this.getActivePdfFile()
        if (file) {
          void this.openFileWithFoxycape(file)
          return
        }
        new Notice(
          this.t(
            'plugin_notice_select_pdf_first',
            'Select or focus a PDF file first.',
          ),
        )
      },
    })

    this.addCommand({
      id: 'pdf-search',
      name: this.t('plugin_command_pdf_search', 'Search in PDF'),
      checkCallback: (checking) => {
        const view = this.getActiveFoxycapePdfView()
        if (!view) {
          return false
        }
        if (!checking) {
          view.requestOpenFind()
        }
        return true
      },
    })

    this.addCommand({
      id: 'pdf-screenshot',
      name: this.t('plugin_command_pdf_screenshot', 'Screenshot region in PDF'),
      checkCallback: (checking) => {
        const view = this.getActiveFoxycapePdfView()
        if (!view) {
          return false
        }
        if (!checking) {
          view.requestToggleScreenshot()
        }
        return true
      },
    })

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
          return
        }
        // Consume here so the menu item closure keeps subpath even after menu closes.
        const subpath = consumePendingPdfLinkSubpath(this, file)
        menu.addItem((item) => {
          item.setTitle(
            this.t('plugin_menu_open_with', 'Open with Foxycape PDF'),
          )
          applyFoxycapeMenuIcon(item)
          item.onClick(() => {
            void this.openFileWithFoxycape(file, subpath)
          })
        })
      }),
    )

    this.addSettingTab(new FoxycapePdfSettingTab(this.app, this))

    // Obsidian usually reloads on language change; still resync when the workspace settles.
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        void this.syncLocaleIfNeeded()
      }),
    )

    // Avoid throwing during onload — that makes Hot Reload report "plugin inactive".
    try {
      this.applyPdfExtensionBinding()
    } catch (error) {
      console.error('[Foxycape PDF] failed to bind pdf extension', error)
    }
  }

  onunload() {
    try {
      this.restoreObsidianPdfBinding()
    } catch (error) {
      console.warn('[Foxycape PDF] failed to restore pdf extension', error)
    }
    disposePdfWorkerBlobSrc()
    disposeWasmSignerBlobUrl()
    void this.storage.dispose()
    void this.locale.dispose()
  }

  t = (key: string, defaultText: string, named?: object) =>
    this.locale.getText(key, defaultText, named)

  /**
   * Unpack worker+signer from main.js (no download). Cmaps/fonts keep
   * downloading in the background and do not block opening a PDF.
   */
  ensureRuntimeAssets = async () => {
    await unpackRuntimeAssets(this, { t: this.t })
    void this.runNetworkWhenAssetsReady()
  }

  /** Unpack worker+signer from main.js (no network). License/API only needs this. */
  ensureEmbeddedRuntimeAssets = async () => {
    await unpackEmbeddedRuntimeAssets(this, { t: this.t })
    void this.runNetworkWhenAssetsReady()
  }

  bootstrapRuntimeAssets = async () => {
    try {
      await this.ensureEmbeddedRuntimeAssets()
    } catch (error) {
      console.error('[Foxycape PDF] failed to extract embedded runtime assets', error)
      new Notice(error instanceof Error ? error.message : String(error), 8000)
    }
    void ensureRemoteRuntimeAssets(this, { t: this.t }).catch((error) => {
      console.warn('[Foxycape PDF] background font download failed', error)
    })
  }

  /** Register device / validate license once signer.js is on disk. */
  runNetworkWhenAssetsReady = async () => {
    if (!(await hasEmbeddedRuntimeAssets(this))) {
      return
    }
    void this.deviceService.registerDevice()
    void this.licenseService.validateOnStartupIfNeeded()
  }

  syncLocaleIfNeeded = async () => {
    const before = this.locale.getCurrentLanguage()
    await this.locale.syncFromObsidian()
    const after = this.locale.getCurrentLanguage()
    if (after !== this.lastSyncedLanguage || after !== before) {
      this.lastSyncedLanguage = after
    }
  }

  loadSettings = async () => {
    const loaded = (await this.loadData()) as Partial<FoxycapePdfSettings> | null
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
    }
  }

  saveSettings = async () => {
    await this.saveData(toPersistedSettings(this.settings))
  }

  updatePdfViewPreferences = async (patch: PdfViewPreferencePatch) => {
    this.settings = {
      ...this.settings,
      ...patch,
    }
    await this.saveSettings()
  }

  setUseAsDefaultPdfViewer = async (value: boolean) => {
    this.settings.useAsDefaultPdfViewer = value
    await this.saveSettings()
    try {
      this.applyPdfExtensionBinding()
      new Notice(
        value
          ? this.t(
              'plugin_notice_default_viewer_enabled',
              'Foxycape PDF is now the default PDF viewer.',
            )
          : this.t(
              'plugin_notice_default_viewer_restored',
              'Restored Obsidian’s built-in PDF viewer as default.',
            ),
      )
    } catch (error) {
      console.error('[Foxycape PDF] failed to update default viewer setting', error)
      new Notice(
        this.t(
          'plugin_notice_default_viewer_update_failed',
          'Failed to update default PDF viewer. See console for details.',
        ),
      )
    }
  }

  openFileWithFoxycape = async (file: TFile, subpath?: string) => {
    await this.openPdfInFoxycape({ file, subpath })
  }

  openUrlWithFoxycape = async (url: string, subpath?: string) => {
    const documentUrl = normalizeRemoteDocumentUrl(url)
    if (!documentUrl) {
      return
    }
    await this.openPdfInFoxycape({ url: documentUrl, subpath })
  }

  private openPdfInFoxycape = async (target: {
    file?: TFile
    url?: string
    subpath?: string
  }) => {
    const normalizedSubpath = normalizePdfSubpath(target.subpath)
    const existing = findExistingPdfLeaf(
      this.app,
      { file: target.file, url: target.url },
      [PDF_READER_VIEW_TYPE],
    )
    if (existing) {
      await revealExistingPdfLeaf(this.app, existing, undefined, normalizedSubpath)
      return
    }

    const leaf = this.app.workspace.getLeaf('tab')
    await leaf.setViewState(
      {
        type: PDF_READER_VIEW_TYPE,
        state: target.file
          ? { file: target.file.path }
          : { url: target.url },
        active: true,
      },
      normalizedSubpath ? { subpath: normalizedSubpath } : undefined,
    )
    void this.app.workspace.revealLeaf(leaf)
  }

  /**
   * Returns false and shows a dialog when trial expired without a valid license.
   * Used to gate premium actions (highlight, citations, image tools); opening PDF stays allowed.
   */
  ensureLicenseEntitlement = (): boolean => {
    if (this.licenseService.isEntitled()) {
      return true
    }
    if (!this.isLicenseModalOpen) {
      this.isLicenseModalOpen = true
      showLicenseRequiredModal(this.app, this.manifest.id, this.t, () => {
        this.isLicenseModalOpen = false
      })
    }
    return false
  }

  private getActivePdfFile = () => {
    const file = this.app.workspace.getActiveFile()
    if (file && file.extension.toLowerCase() === 'pdf') {
      return file
    }
    return this.getActiveFoxycapePdfView()?.file ?? null
  }

  private getActiveFoxycapePdfView = (): PdfReaderView | null => {
    const view = this.app.workspace.getActiveViewOfType(PdfReaderView)
    return view ?? null
  }

  private applyPdfExtensionBinding = () => {
    if (this.settings.useAsDefaultPdfViewer) {
      if (!this.isDefaultPdfBindingActive) {
        // pdf is already claimed by Obsidian core — unregister before rebinding.
        this.bindPdfExtension(PDF_READER_VIEW_TYPE)
        this.isDefaultPdfBindingActive = true
      }
      return
    }

    // Not the default viewer: only restore built-in if we previously took over.
    if (this.isDefaultPdfBindingActive) {
      this.restoreObsidianPdfBinding()
    }
  }

  private restoreObsidianPdfBinding = () => {
    this.bindPdfExtension(OBSIDIAN_PDF_VIEW_TYPE)
    this.isDefaultPdfBindingActive = false
  }

  /**
   * Rebind .pdf via viewRegistry directly.
   * Avoid Plugin.registerExtensions: its unload disposer would unregister again
   * after we restore the built-in viewer.
   */
  private bindPdfExtension = (viewType: string) => {
    const viewRegistry = this.getViewRegistry()
    if (!viewRegistry?.unregisterExtensions || !viewRegistry.registerExtensions) {
      throw new Error('viewRegistry extension APIs are unavailable')
    }

    viewRegistry.unregisterExtensions(['pdf'])
    viewRegistry.registerExtensions(['pdf'], viewType)
  }

  private getViewRegistry = (): ViewRegistryLike | null => {
    const viewRegistry = (this.app as unknown as { viewRegistry?: ViewRegistryLike }).viewRegistry
    return viewRegistry ?? null
  }
}
