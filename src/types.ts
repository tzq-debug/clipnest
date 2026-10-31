export type ItemType = 'text' | 'image' | 'files'

export interface ClipItem {
  id: string
  type: ItemType
  preview: string
  chars: number
  files: string[] | null
  image: string | null
  thumb: string | null
  width: number
  height: number
  bytes: number
  createdAt: number
  pinned: boolean
}

export type Filter = 'all' | 'text' | 'image' | 'files' | 'pinned'

export type MergeSeparator = 'newline' | 'blank' | 'space' | 'none'

export interface Settings {
  maxItems: number
  paused: boolean
  captureImages: boolean
  captureFiles: boolean
  maxTextLength: number
  ignoreKeywords: string[]
  shortcut: string
  collapseOnCopy: boolean
  sequentialDelay: number
  mergeSeparator: MergeSeparator
  showDock: boolean
  launchAtLogin: boolean
  theme: 'system' | 'light' | 'dark'
  onboarded: boolean
}

export type View = 'collapsed' | 'expanded' | 'palette'

export interface AppState {
  view: View
  items: ClipItem[]
  settings: Settings
  hotkeyOk: boolean
  version: string
  platform: string
  dataDir: string
}

export interface ImageAsset {
  thumb: string | null
  full: string | null
}

export interface CopyResult {
  ok: boolean
  message: string
  count?: number
}

export interface ClipNestApi {
  getState: () => Promise<AppState>
  onState: (fn: (s: AppState) => void) => () => void
  onClosing: (fn: () => void) => () => void
  setView: (view: View) => Promise<View>
  hover: (inside: boolean) => Promise<boolean>
  dismiss: () => Promise<boolean>
  copy: (ids: string[], mode: 'merged' | 'sequential') => Promise<CopyResult>
  pin: (id: string, value: boolean) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  reveal: (id: string) => Promise<boolean>
  clear: (keepPinned: boolean) => Promise<boolean>
  getImages: (ids: string[]) => Promise<Record<string, ImageAsset>>
  updateSettings: (patch: Partial<Settings>) => Promise<{ settings: Settings; hotkeyOk: boolean }>
  openDataDir: () => Promise<string>
  appInfo: () => Promise<{ version: string; dataDir: string; platform: string; electron: string }>
  quit: () => Promise<void>
}
