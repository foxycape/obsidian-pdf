import type { ColorMode, FlipMode, IThemeProvider } from '../../kernal'
import {
  FilePackage,
  Options,
  PluginRegistry,
  Reader,
  SpineFile,
  Theme,
} from '../../kernal'
import { HtmlRenderer } from '../../mediaTypes/html/renderer/HtmlRenderer'
import { ContentCssVariables, registerHtmlMediaType } from './registerHtmlMediaType'
import { KeyboardPageTurning } from '../../kernal/plugins/keyboard/KeyboardPageTurning'
import { WheelPageTurning } from '../../kernal/plugins/mouse/WheelPageTurning'
import { HtmlOptions } from '../../mediaTypes/html/HtmlOptions'

const sampleUrl = new URL('./fixtures/sample.html', import.meta.url).href

const readerRoot = document.querySelector<HTMLElement>('#reader-root')
const statusEl = document.querySelector<HTMLElement>('#status')
const btnSample = document.querySelector<HTMLButtonElement>('#btn-sample')
const btnReload = document.querySelector<HTMLButtonElement>('#btn-reload')
const fileInput = document.querySelector<HTMLInputElement>('#file-input')
const btnLayoutScroll = document.querySelector<HTMLButtonElement>('#btn-layout-scroll')
const btnLayoutPage = document.querySelector<HTMLButtonElement>('#btn-layout-page')
const columnsControl = document.querySelector<HTMLElement>('#columns-control')
const selectColumns = document.querySelector<HTMLSelectElement>('#select-columns')
const selectStylePreset = document.querySelector<HTMLSelectElement>('#select-style-preset')
const selectLayoutPreset = document.querySelector<HTMLSelectElement>('#select-layout-preset')
const inputFontSize = document.querySelector<HTMLInputElement>('#input-font-size')
const inputLineHeight = document.querySelector<HTMLInputElement>('#input-line-height')
const inputParagraphSpacing = document.querySelector<HTMLInputElement>('#input-paragraph-spacing')
const inputBgColor = document.querySelector<HTMLInputElement>('#input-bg-color')
const btnResetStyle = document.querySelector<HTMLButtonElement>('#btn-reset-style')

if (
  !readerRoot ||
  !statusEl ||
  !btnSample ||
  !btnReload ||
  !fileInput ||
  !btnLayoutScroll ||
  !btnLayoutPage ||
  !columnsControl ||
  !selectColumns ||
  !selectStylePreset ||
  !selectLayoutPreset ||
  !inputFontSize ||
  !inputLineHeight ||
  !inputParagraphSpacing ||
  !inputBgColor ||
  !btnResetStyle
) {
  throw new Error('sample page DOM is incomplete')
}

type OpenTarget = {
  label: string
  source: Blob | ArrayBuffer | FilePackage
  extension: string
  resourceId?: string
}

type StylePreset = {
  label: string
  /** Typography CSS variables (via styleProvider) */
  layoutVars: Record<string, string>
  /** Theme name (via changeTheme / HtmlThemeApplier) */
  themeName?: string
  form?: {
    fontSize?: string
    lineHeight?: string
    paragraphSpacing?: string
    bgColor?: string
  }
}

type ThemeDefinition = {
  name: string
  title: string
  colorMode: ColorMode
  isDefault?: boolean
  readerBackground: string
  contentBackground: string
  contentTextColor: string
  codeblockBackgroundColor: string
  scrollbarTrackColor: string
  scrollbarThumbColor: string
  scrollbarThumbHoverColor: string
}

/** Default typography CSS variables (injected before opening a document) */
const injectedDefaultCssVariables: Record<string, string> = {
  [ContentCssVariables.FontSize]: '18px',
  [ContentCssVariables.FontFamily]:
    "'Georgia','Songti SC','SimSun','Segoe UI','PingFang SC','Microsoft YaHei',serif",
  [ContentCssVariables.TextLineHeight]: '1.65em',
  [ContentCssVariables.ParagraphMarginTop]: '0.5em',
  [ContentCssVariables.ParagraphMarginBottom]: '0.5em',
  [ContentCssVariables.TextIndent]: '2em',
}

const themeDefinitions: Record<string, ThemeDefinition> = {
  default: {
    name: 'default',
    title: 'Default',
    colorMode: 'light',
    isDefault: true,
    readerBackground: '#f1f1f1',
    contentBackground: '#ffffff',
    contentTextColor: 'inherit',
    codeblockBackgroundColor: '#f4f1ea',
    scrollbarTrackColor: '#dfdfdf',
    scrollbarThumbColor: '#777',
    scrollbarThumbHoverColor: '#555',
  },
  night: {
    name: 'night',
    title: 'Night',
    colorMode: 'dark',
    readerBackground: '#12151a',
    contentBackground: '#1b1f27',
    contentTextColor: '#d7dde8',
    codeblockBackgroundColor: '#11151c',
    scrollbarTrackColor: '#2e2e2e',
    scrollbarThumbColor: '#777',
    scrollbarThumbHoverColor: '#999',
  },
  sepia: {
    name: 'sepia',
    title: 'Sepia',
    colorMode: 'other',
    readerBackground: '#ebe1c8',
    contentBackground: '#f4ecd8',
    contentTextColor: '#5b4636',
    codeblockBackgroundColor: '#ebe1c8',
    scrollbarTrackColor: '#db995e1a',
    scrollbarThumbColor: '#db995e80',
    scrollbarThumbHoverColor: '#db995ecc',
  },
}

const buildTheme = (definition: ThemeDefinition, overrides?: Partial<Theme>): Theme => {
  const theme = new Theme()
  theme.name = definition.name
  theme.title = definition.title
  theme.colorMode = definition.colorMode
  theme.isDefault = definition.isDefault ?? false
  theme.readerBackground = definition.readerBackground
  theme.contentBackground = definition.contentBackground
  theme.contentTextColor = definition.contentTextColor
  theme.codeblockBackgroundColor = definition.codeblockBackgroundColor
  theme.scrollbarTrackColor = definition.scrollbarTrackColor
  theme.scrollbarThumbColor = definition.scrollbarThumbColor
  theme.scrollbarThumbHoverColor = definition.scrollbarThumbHoverColor
  if (overrides) {
    Object.assign(theme, overrides)
  }
  return theme
}

const themesByName = new Map<string, Theme>(
  Object.values(themeDefinitions).map((definition) => [definition.name, buildTheme(definition)]),
)

/** Style presets: theme / background colors */
const stylePresets: Record<string, StylePreset> = {
  default: {
    label: 'Default',
    themeName: 'default',
    layoutVars: {},
    form: { bgColor: '#ffffff' },
  },
  night: {
    label: 'Night',
    themeName: 'night',
    layoutVars: {},
    form: { bgColor: '#1b1f27' },
  },
  sepia: {
    label: 'Sepia',
    themeName: 'sepia',
    layoutVars: {},
    form: { bgColor: '#f4ecd8' },
  },
}

/** Typography presets: font size / line height / paragraph spacing */
const layoutPresets: Record<string, StylePreset> = {
  default: {
    label: 'Default',
    layoutVars: { ...injectedDefaultCssVariables },
    form: { fontSize: '18', lineHeight: '1.65', paragraphSpacing: '0.5' },
  },
  large: {
    label: 'Large Type',
    layoutVars: {
      [ContentCssVariables.FontSize]: '22px',
      [ContentCssVariables.TextLineHeight]: '1.8em',
      [ContentCssVariables.ParagraphMarginTop]: '0.7em',
      [ContentCssVariables.ParagraphMarginBottom]: '0.7em',
    },
    form: { fontSize: '22', lineHeight: '1.8', paragraphSpacing: '0.7' },
  },
  compact: {
    label: 'Compact',
    layoutVars: {
      [ContentCssVariables.FontSize]: '15px',
      [ContentCssVariables.TextLineHeight]: '1.45em',
      [ContentCssVariables.ParagraphMarginTop]: '0.3em',
      [ContentCssVariables.ParagraphMarginBottom]: '0.3em',
      [ContentCssVariables.TextIndent]: '1.5em',
    },
    form: { fontSize: '15', lineHeight: '1.45', paragraphSpacing: '0.3' },
  },
}

const options = new Options()
options.debug = true
options.themeName = 'default'
options.enableFooter = false
options.enableHeader = false

const reader = new Reader(options)

PluginRegistry.register('keyboard-page-turning', KeyboardPageTurning)
PluginRegistry.register('wheel-page-turning', WheelPageTurning)

const sampleThemeProvider: IThemeProvider = {
  initialize: async () => { },
  getThemes: () => Array.from(themesByName.values()),
  getTheme: (themeName: string) => themesByName.get(themeName),
  getCurrentTheme: () => themesByName.get(reader.options.themeName) ?? themesByName.get('default'),
  dispose: async () => { },
}
reader.services.add('themeProvider', () => sampleThemeProvider)

const htmlOptions = registerHtmlMediaType(reader, {
  defaultContentCssVariables: injectedDefaultCssVariables,
  htmlOptions: {
    // writingMode: 'vertical-lr',
    // direction: 'ltr',
  } as HtmlOptions,
})
// On Chromium, about:blank + document.write can yield an empty document; prefer srcdoc
// htmlOptions.preferSrcdoc = true

let lastTarget: OpenTarget | null = null

const getHtmlRenderer = () => {
  const renderer = reader.getRenderer()
  return renderer instanceof HtmlRenderer ? renderer : null
}

const setStatus = (text: string, kind: 'ok' | 'error' | '' = '') => {
  statusEl.textContent = text
  statusEl.classList.remove('ok', 'error')
  if (kind) {
    statusEl.classList.add(kind)
  }
}

const setBusy = (isBusy: boolean) => {
  const controls = [
    btnSample,
    btnReload,
    fileInput,
    btnLayoutScroll,
    btnLayoutPage,
    selectColumns,
    selectStylePreset,
    selectLayoutPreset,
    inputFontSize,
    inputLineHeight,
    inputParagraphSpacing,
    inputBgColor,
    btnResetStyle,
  ] as const
  for (const el of controls) {
    el.disabled = isBusy
  }
  btnReload.disabled = isBusy || !lastTarget
}

const syncLayoutButtons = () => {
  const flipMode = htmlOptions.flipMode
  btnLayoutScroll.classList.toggle('active', flipMode === 'scroll')
  btnLayoutPage.classList.toggle('active', flipMode === 'page')
  columnsControl.hidden = flipMode !== 'page'
}

const syncFormFromPreset = (preset: StylePreset) => {
  if (preset.form?.fontSize) inputFontSize.value = preset.form.fontSize
  if (preset.form?.lineHeight) inputLineHeight.value = preset.form.lineHeight
  if (preset.form?.paragraphSpacing) inputParagraphSpacing.value = preset.form.paragraphSpacing
  if (preset.form?.bgColor) inputBgColor.value = preset.form.bgColor
}

const resolveExtension = (nameOrUrl: string, fallback = '.html') => {
  const match = /\.(html?|xhtml)$/i.exec(nameOrUrl)
  return match ? `.${match[1].toLowerCase()}` : fallback
}

const isDarkColor = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return false
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

const resolveColorModeForPicker = (bgColor: string, baseThemeName: string): ColorMode => {
  if (baseThemeName === 'night' || isDarkColor(bgColor)) {
    return 'dark'
  }
  if (baseThemeName === 'default' && bgColor.toLowerCase() === '#ffffff') {
    return 'light'
  }
  return 'other'
}

const applyLayoutVariables = async (vars: Record<string, string>, message?: string) => {
  const renderer = getHtmlRenderer()
  const styleProvider = renderer?.styleProvider
  if (!styleProvider) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return false
  }
  await styleProvider.changeStyles(new Map(Object.entries(vars)))
  if (message) {
    setStatus(message, 'ok')
  }
  return true
}

const applyThemeByName = async (themeName: string, overrides?: Partial<Theme>) => {
  const definition = themeDefinitions[themeName]
  if (!definition) {
    setStatus(`Theme not found: ${themeName}`, 'error')
    return false
  }
  themesByName.set(themeName, buildTheme(definition, overrides))
  await reader.changeTheme(themeName)
  return true
}

const applyPreset = async (preset: StylePreset, message: string) => {
  if (preset.themeName) {
    const ok = await applyThemeByName(preset.themeName)
    if (!ok) {
      return
    }
  }
  if (Object.keys(preset.layoutVars).length > 0) {
    await applyLayoutVariables(preset.layoutVars, message)
    return
  }
  setStatus(message, 'ok')
}

const openTarget = async (target: OpenTarget) => {
  setBusy(true)
  setStatus(`Loading: ${target.label}`)
  try {
    await reader.open(target.source, readerRoot, readerRoot, {
      extension: target.extension,
      fileName: target.label,
      resourceId: target.resourceId,
    })
    lastTarget = target
    const documents = reader.getRenderer()?.getDocuments() ?? []
    setStatus(
      `Loaded: ${target.label} (documents ${documents.length}, flipMode=${htmlOptions.flipMode}, columns=${htmlOptions.autoColumns ? 'auto' : htmlOptions.columns})`,
      'ok',
    )
    syncLayoutButtons()
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    setStatus(`Load failed: ${message}`, 'error')
  } finally {
    setBusy(false)
  }
}

const buildOpenTargetFromFiles = (files: File[]): OpenTarget | null => {
  if (files.length === 0) {
    return null
  }
  if (files.length === 1) {
    const file = files[0]
    return {
      label: file.name,
      source: file,
      extension: resolveExtension(file.name),
    }
  }

  const spineFiles = files.map(
    (file) => new SpineFile(file, file.name, resolveExtension(file.name)),
  )
  const source = new FilePackage()
  source.spineFiles = spineFiles
  source.extension = resolveExtension(files[0].name)
  const label = files.map((file) => file.name).join(', ')
  return {
    label,
    source,
    extension: source.extension,
    resourceId: files.map((file) => file.name).join('|'),
  }
}

const fixtureAssetNames = ['logo.png', 'photo-a.png', 'photo-b.png', 'diagram.svg', 'embedded-image.svg'] as const

const resolveFixtureAssetUrls = (html: string) => {
  let next = html
  for (const name of fixtureAssetNames) {
    const absoluteUrl = new URL(`./fixtures/${name}`, import.meta.url).href
    next = next.replaceAll(`"${name}"`, `"${absoluteUrl}"`)
    next = next.replaceAll(`'${name}'`, `'${absoluteUrl}'`)
  }
  return next
}

const loadSample = async () => {
  const response = await fetch(sampleUrl)
  if (!response.ok) {
    throw new Error(`Failed to read sample file: ${response.status} ${response.statusText}`)
  }
  const html = resolveFixtureAssetUrls(await response.text())
  const source = new Blob([html], { type: 'text/html;charset=utf-8' })
  await openTarget({
    label: 'fixtures/sample.html',
    source,
    extension: '.html',
  })
}

const resolveContentTextColor = (themeName: string, colorMode: ColorMode) => {
  if (colorMode === 'light') {
    return 'inherit'
  }
  const definition = themeDefinitions[themeName] ?? themeDefinitions.default
  if (definition.contentTextColor !== 'inherit') {
    return definition.contentTextColor
  }
  return colorMode === 'dark' ? '#d7dde8' : '#5b4636'
}

const applyTypographyStyles = async () => {
  const fontSize = Number(inputFontSize.value)
  const lineHeight = Number(inputLineHeight.value)
  const paragraphSpacing = Number(inputParagraphSpacing.value)
  const resolvedParagraphSpacing = Number.isFinite(paragraphSpacing) ? paragraphSpacing : 0.5
  const layoutVars: Record<string, string> = {
    [ContentCssVariables.FontSize]: `${Number.isFinite(fontSize) ? fontSize : 18}px`,
    [ContentCssVariables.TextLineHeight]: `${Number.isFinite(lineHeight) ? lineHeight : 1.65}em`,
    [ContentCssVariables.ParagraphMarginTop]: `${resolvedParagraphSpacing}em`,
    [ContentCssVariables.ParagraphMarginBottom]: `${resolvedParagraphSpacing}em`,
  }
  await applyLayoutVariables(layoutVars, 'Applied typography')
}

const applyBackgroundStyle = async () => {
  const themeName = reader.options.themeName || 'default'
  const definition = themeDefinitions[themeName] ?? themeDefinitions.default
  const colorMode = resolveColorModeForPicker(inputBgColor.value, themeName)
  const ok = await applyThemeByName(themeName, {
    contentBackground: inputBgColor.value,
    contentTextColor: resolveContentTextColor(themeName, colorMode),
    readerBackground: definition.readerBackground,
    colorMode,
  })
  if (ok) {
    setStatus('Applied background', 'ok')
  }
}

const changeFlipMode = async (flipMode: FlipMode) => {
  if (htmlOptions.flipMode === flipMode) {
    return
  }
  const renderer = getHtmlRenderer()
  if (!renderer) {
    htmlOptions.flipMode = flipMode
    syncLayoutButtons()
    setStatus(`Layout set to ${flipMode} (takes effect on next load)`)
    return
  }
  setBusy(true)
  try {
    await renderer.layout.changeFlipMode(flipMode)
    syncLayoutButtons()
    setStatus(`Layout switched to ${flipMode}`, 'ok')
  } catch (error) {
    console.error(error)
    setStatus(`Layout switch failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

const changeColumns = async () => {
  const value = selectColumns.value
  const autoColumns = value === 'auto'
  const columns = autoColumns ? 1 : Number(value)
  const renderer = getHtmlRenderer()
  if (!renderer) {
    htmlOptions.autoColumns = autoColumns
    htmlOptions.columns = columns
    setStatus(`Columns set to ${value} (takes effect on next load)`)
    return
  }
  setBusy(true)
  try {
    await renderer.layout.changeColumns({ columns, autoColumns })
    setStatus(`Columns switched to ${value}`, 'ok')
  } catch (error) {
    console.error(error)
    setStatus(`Columns switch failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

btnSample.addEventListener('click', () => {
  void loadSample()
})

btnReload.addEventListener('click', () => {
  if (!lastTarget) {
    return
  }
  void openTarget(lastTarget)
})

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files ?? [])
  const target = buildOpenTargetFromFiles(files)
  if (!target) {
    return
  }
  void openTarget(target).finally(() => {
    fileInput.value = ''
  })
})

btnLayoutScroll.addEventListener('click', () => {
  void changeFlipMode('scroll')
})

btnLayoutPage.addEventListener('click', () => {
  void changeFlipMode('page')
})

selectColumns.addEventListener('change', () => {
  void changeColumns()
})

selectStylePreset.addEventListener('change', () => {
  const preset = stylePresets[selectStylePreset.value]
  if (!preset) {
    return
  }
  syncFormFromPreset(preset)
  void applyPreset(preset, `Applied style preset: ${preset.label}`)
})

selectLayoutPreset.addEventListener('change', () => {
  const preset = layoutPresets[selectLayoutPreset.value]
  if (!preset) {
    return
  }
  syncFormFromPreset(preset)
  void applyPreset(preset, `Applied typography preset: ${preset.label}`)
})

for (const input of [inputFontSize, inputLineHeight, inputParagraphSpacing]) {
  input.addEventListener('input', () => {
    void applyTypographyStyles()
  })
}

inputBgColor.addEventListener('input', () => {
  void applyBackgroundStyle()
})

btnResetStyle.addEventListener('click', () => {
  const renderer = getHtmlRenderer()
  if (!renderer?.styleProvider) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return
  }
  selectStylePreset.value = 'default'
  selectLayoutPreset.value = 'default'
  syncFormFromPreset(stylePresets.default)
  syncFormFromPreset(layoutPresets.default)
  void (async () => {
    await renderer.styleProvider.resetStyles()
    renderer.styleProvider.initialize(new Map(Object.entries(injectedDefaultCssVariables)))
    await applyPreset(stylePresets.default, '')
    await applyPreset(layoutPresets.default, 'Reset to default style and typography')
  })()
})

syncFormFromPreset(stylePresets.default)
syncFormFromPreset(layoutPresets.default)
syncLayoutButtons()
void loadSample()
