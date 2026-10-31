import type { ClipNestApi } from './types'

declare global {
  interface Window {
    clipnest: ClipNestApi
  }
}

export {}
