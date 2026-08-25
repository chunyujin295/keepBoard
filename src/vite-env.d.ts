/// <reference types="vite/client" />

declare global {
  interface Window {
    keepboard: import('../../electron/preload').KeepboardAPI
  }
}
export {}
