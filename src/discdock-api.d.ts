import type { DiscDockApi } from '../electron/preload'

declare global {
  interface Window {
    discdock: DiscDockApi
  }
}

export {}
