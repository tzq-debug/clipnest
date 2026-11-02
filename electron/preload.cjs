'use strict'

const { contextBridge, ipcRenderer, webUtils } = require('electron')

const listeners = new Set()
const closingListeners = new Set()

ipcRenderer.on('state', (_event, payload) => {
  listeners.forEach((fn) => {
    try {
      fn(payload)
    } catch (err) {
      console.error(err)
    }
  })
})

ipcRenderer.on('view:closing', () => {
  closingListeners.forEach((fn) => {
    try {
      fn()
    } catch (err) {
      console.error(err)
    }
  })
})

contextBridge.exposeInMainWorld('clipnest', {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  onClosing: (fn) => {
    closingListeners.add(fn)
    return () => closingListeners.delete(fn)
  },

  setView: (view) => ipcRenderer.invoke('view:set', view),
  dismiss: () => ipcRenderer.invoke('view:dismiss'),
  collapse: () => ipcRenderer.invoke('view:collapse'),

  copy: (ids, mode) => ipcRenderer.invoke('copy', { ids, mode }),
  openImage: (id) => ipcRenderer.invoke('image:open', id),
  setModal: (open) => ipcRenderer.invoke('ui:modal', open),
  pin: (id, value) => ipcRenderer.invoke('item:pin', id, value),
  star: (id, value) => ipcRenderer.invoke('item:star', id, value),
  seal: (id, value) => ipcRenderer.invoke('item:seal', id, value),
  drag: (id) => ipcRenderer.invoke('item:drag', id),
  // Files dropped from Explorer arrive as File objects; only the preload can
  // turn one into a real path.
  pathForFile: (file) => webUtils.getPathForFile(file),
  dropFiles: (paths) => ipcRenderer.invoke('files:drop', paths),
  remove: (id) => ipcRenderer.invoke('item:remove', id),
  reveal: (id) => ipcRenderer.invoke('item:reveal', id),
  clear: (keepPinned) => ipcRenderer.invoke('items:clear', keepPinned),
  exportItems: (payload) => ipcRenderer.invoke('items:export', payload),
  getImages: (ids) => ipcRenderer.invoke('images:get', ids),

  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  unlockVault: (password) => ipcRenderer.invoke('vault:unlock', password),
  lockVault: () => ipcRenderer.invoke('vault:lock'),
  enableEncryption: (password) => ipcRenderer.invoke('vault:enable', password),
  disableEncryption: (password) => ipcRenderer.invoke('vault:disable', password),
  openDataDir: () => ipcRenderer.invoke('app:openData'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  quit: () => ipcRenderer.invoke('app:quit')
})
