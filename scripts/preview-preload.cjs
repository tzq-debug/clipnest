'use strict'

/* Preview harness: renders the real UI against mock clipboard data so the layout
 * can be reviewed without touching the system clipboard. Dev only. */

const { contextBridge } = require('electron')

const THUMB =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAACHCAIAAACnEEO8AAADM0lEQVR42u3dsU5TURgH8HMbnkBSFrESS6IOGBcNCyR10TjiVo2T6DNoiLQW8Rl0NLABj8BQBngINVDbBVKewZkEdbn39N7T3y937vD14/DPl6/nZosLywFSUVMCUjITQqYKpNPQ2pm0TuhMSyNDQ1kjhxMaJzTI0GDKAebQyNCQROSQoXFCgwwNphxgDo0MDXY5wAkNMjSYcmAODTI02OUAJzTI0JhygDk0yNBQkV2O7qfdaa7s5seX2iu+7MHdp1pZWyfU0Pee5dzN3R1lvdLTm68UIV6GzkLI8dHN1/6F51tkzz+eWo6f1tHNf9Hp7mi2OI8pB2ll6If3n+eTFDvfVfM/2aPzWhHMoSHY5Sjp/0MlsMuhnbHLUdKOVmoZGtzLUdbIodROaJChZWhTDkw5zKHR0jI0uJcjjQit1NU5oT/33qim+sjQAjRl/cXKdm9dQa+13Vu3ex/pebS0lu+X92Hjmw6+0s1bbxWhwlMO359qTDLYPV56UdBHv9/4Os2V/bL1Tnsl1dBglwPscoA5NMGUA+xygBMaZGgw5cAcGmRoqOq9HKtPvIehwvqHu05o3ZyOSn+DtZBlOT66OZ2ezrUxoj15/mJltdXWCun0dKs91e9YWdHNyVlptb1jBexyENwlYg4NdjlI+zoRuxwkdTuOXQ6SutNahsYuB94L44QGGRoZekK3jx7393z7iTnu703vLkcI2XF/XxMk1M37VbxNt1ZAFUijm+1yhBBCODk6WF5Z0xPVdXJ0UN0Nn5mCKqItsMsBdjnAHJrgXg6wywFOaJChwZQDc2iQoaHC93LMNRZVtmjngx+KEOOE1s1xqHOMDD3XaKppzJ4+H/xUh6KmHHXdPIGebl7o6SLm0PVbd1RzIuqN5sXvX+pgyoFdDoLbM5zQYJeDhG/PqMCUYzw8nZ1fUND4xsNT7VzIHHo8PJudv62mcbv5zDZOgRl6PDxT07jdTMG7HJejwY2bDZUt2uVo4P04ke7luBwNVBb70OAXK2AOTTDlALsc4IQGGRpMOTCHBhkaKnwvBzihQYYGUw7MoUGGBrsc4IQGGRpTDjCHBhka7HKAExoZGsrqD81OcQenlBSFAAAAAElFTkSuQmCC'

const now = Date.now()

function text(id, body, minutes, extra = {}) {
  return {
    id,
    type: 'text',
    isImage: false,
    big: null,
    sensitive: null,
    sensitiveLabel: null,
    sealed: false,
    preview: body,
    chars: body.length,
    files: null,
    image: null,
    thumb: null,
    width: 0,
    height: 0,
    bytes: 0,
    createdAt: now - minutes * 60_000,
    pinned: false,
    starred: false,
    ...extra
  }
}

const FORCE_LOCK = process.env.CLIPNEST_PREVIEW_LOCKED === '1'
const FORCE_ENC = process.env.CLIPNEST_PREVIEW_ENCRYPTED === '1'

let state = {
  view: 'palette',
  locked: FORCE_LOCK,
  encrypted: FORCE_ENC,
  hotkeyOk: true,
  version: '0.1.0',
  platform: 'win32',
  dataDir: 'C:\\Users\\you\\AppData\\Roaming\\ClipNest',
  settings: {
    maxItems: 500,
    paused: false,
    captureImages: true,
    captureFiles: true,
    maxTextLength: 20000,
    ignoreKeywords: ['password'],
    shortcut: 'Control+Shift+V',
    collapseOnCopy: true,
    sequentialDelay: 380,
    mergeSeparator: 'newline',
    showDock: true,
    launchAtLogin: false,
    theme: 'light',
    sensitiveEnabled: true,
    sensitivePolicy: 'seal',
    onboarded: true
  },
  items: [
    text('1', '把几段文字分开复制，再用 ClipNest 一次性合并粘贴，这就是它和普通剪贴板工具的区别。', 0.2),
    text('2', 'https://github.com/tzq-debug/clipnest', 3),
    {
      id: '3',
      type: 'image',
      preview: '',
      chars: 0,
      files: null,
      isImage: false,
      image: 'a.png',
      thumb: 'a.thumb.png',
      big: 'a.big.png',
      width: 1280,
      height: 720,
      bytes: 348_000,
      createdAt: now - 9 * 60_000,
      pinned: false
    },
    {
      id: '4',
      type: 'files',
      preview: '',
      chars: 0,
      isImage: false,
      files: ['D:\\work\\clipnest\\README.md', 'D:\\work\\clipnest\\LICENSE', 'D:\\work\\clipnest\\package.json'],
      image: null,
      thumb: null,
      big: null,
      width: 0,
      height: 0,
      bytes: 24_500,
      createdAt: now - 21 * 60_000,
      pinned: false
    },
    {
      id: '9',
      type: 'files',
      preview: '',
      chars: 0,
      isImage: true,
      files: ['D:\\Pictures\\Screenshots\\屏幕截图 2026-11-01 110233.png'],
      image: null,
      thumb: 'b.thumb.png',
      big: 'b.big.png',
      width: 1920,
      height: 1080,
      bytes: 1_240_000,
      createdAt: now - 12 * 60_000,
      pinned: false
    },
    text(
      '5',
      '这是一段比较长的文本，用来测试列表里三行截断的效果。剪贴板历史工具需要清楚地展示内容，同时又不能占用太多屏幕空间，所以每一条只显示前几行，点击就能复制整条内容。',
      40
    ),
    text('6', '会议纪要：周四下午三点，讨论 v0.2 的加密存储方案', 95, { pinned: true }),
    text('10', '', 6, { sensitive: 'api-key', sensitiveLabel: 'API 密钥', chars: 51 }),
    text('7', 'npm run dist:win', 180),
    text('8', '订单号 20261031-8842 · 收货人 张先生 · 13800000000', 300, { starred: true })
  ]
}

const listeners = new Set()

function push() {
  listeners.forEach((fn) => fn(JSON.parse(JSON.stringify(state))))
}

const api = {
  getState: async () => JSON.parse(JSON.stringify(state)),
  onState: (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  onClosing: () => () => {},
  setView: async (v) => {
    state.view = v
    push()
    return v
  },
  hover: async () => true,
  dismiss: async () => true,
  copy: async (ids, mode) => {
    console.log('[mock-copy]', mode, JSON.stringify(ids))
    return { ok: true, message: '预览模式不会真的写剪贴板' }
  },
  seal: async (id, value) => {
    const it = state.items.find((i) => i.id === id)
    if (!it) return { ok: false, message: '找不到这条记录' }
    if (it.type !== 'text') return { ok: false, message: '只能加密文本条目' }
    if (value) {
      it.backup = it.preview
      it.sealed = true
      it.sensitive = 'manual'
      it.sensitiveLabel = '手动加密'
      it.preview = ''
    } else {
      it.sealed = false
      it.sensitive = null
      it.sensitiveLabel = null
      it.preview = it.backup || ''
    }
    push()
    return { ok: true, sealed: value }
  },
  star: async (id, value) => {
    const it = state.items.find((i) => i.id === id)
    if (it) it.starred = value
    push()
    return true
  },
  pin: async (id, value) => {
    const it = state.items.find((i) => i.id === id)
    if (it) it.pinned = value
    push()
    return true
  },
  remove: async (id) => {
    state.items = state.items.filter((i) => i.id !== id)
    push()
    return true
  },
  reveal: async () => true,
  clear: async () => {
    const cleared = state.items.filter((i) => !i.starred).length
    state.items = state.items.filter((i) => i.starred)
    push()
    return { cleared }
  },
  getImages: async (ids) => {
    const out = {}
    ids.forEach((id) => {
      out[id] = { thumb: THUMB, full: THUMB }
    })
    return out
  },
  updateSettings: async (patch) => {
    state.settings = { ...state.settings, ...patch }
    push()
    return { settings: state.settings, hotkeyOk: true }
  },
  setModal: async () => true,
  unlockVault: async (pw) => (pw === "pw" ? { ok: true, count: 3 } : { ok: false, message: "密码不对" }),
  lockVault: async () => { state.locked = true; state.items = []; push(); return { ok: true } },
  enableEncryption: async () => { state.encrypted = true; push(); return { ok: true } },
  disableEncryption: async () => ({ ok: true }),
  openImage: async () => true,
  openDataDir: async () => '',
  appInfo: async () => ({ version: '0.1.0', dataDir: state.dataDir, platform: 'win32', electron: '45' }),
  quit: async () => {}
}

contextBridge.exposeInMainWorld('clipnest', api)
