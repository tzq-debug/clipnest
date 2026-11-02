export type ItemType = 'text' | 'image' | 'files'

export type SensitiveKind = 'private-key' | 'api-key' | 'jwt' | 'id-card' | 'bank-card' | 'credential'

export interface ClipItem {
  id: string
  type: ItemType
  /** A file item whose files are all pictures (screenshots copied as files). */
  isImage: boolean
  preview: string
  chars: number
  files: string[] | null
  image: string | null
  thumb: string | null
  big: string | null
  width: number
  height: number
  bytes: number
  createdAt: number
  /** Kept at the top of the list. */
  pinned: boolean
  /** Kept in 收藏, and kept when the history is cleared. */
  starred: boolean
  /** Set when the text was sealed with the OS key and masked in the list. */
  sensitive: SensitiveKind | null
  sensitiveLabel: string | null
  /** True while the text only exists as ciphertext. */
  sealed: boolean
}

export type Filter = 'all' | 'text' | 'image' | 'files' | 'starred'

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
  sensitiveEnabled: boolean
  sensitivePolicy: 'seal' | 'skip'
  onboarded: boolean
}

export type View = 'collapsed' | 'expanded' | 'palette'

export interface AppState {
  view: View
  locked: boolean
  encrypted: boolean
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
  openImage: (id: string) => Promise<boolean>
  setModal: (open: boolean) => Promise<boolean>
  pin: (id: string, value: boolean) => Promise<boolean>
  star: (id: string, value: boolean) => Promise<boolean>
  seal: (id: string, value: boolean) => Promise<{ ok: boolean; sealed?: boolean; message?: string }>
  drag: (id: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  reveal: (id: string) => Promise<boolean>
  clear: (keepPinned: boolean) => Promise<{ cleared: number }>
  exportItems: (payload: {
    ids?: string[]
    format?: 'md' | 'json'
  }) => Promise<{ ok: boolean; path?: string; count?: number; images?: number; canceled?: boolean; message?: string }>
  getImages: (ids: string[]) => Promise<Record<string, ImageAsset>>
  updateSettings: (patch: Partial<Settings>) => Promise<{ settings: Settings; hotkeyOk: boolean }>
  unlockVault: (password: string) => Promise<{ ok: boolean; message?: string; count?: number }>
  lockVault: () => Promise<{ ok: boolean }>
  enableEncryption: (password: string) => Promise<{ ok: boolean; message?: string }>
  disableEncryption: (password: string) => Promise<{ ok: boolean; message?: string }>
  openDataDir: () => Promise<string>
  appInfo: () => Promise<{ version: string; dataDir: string; platform: string; electron: string }>
  quit: () => Promise<void>
}
