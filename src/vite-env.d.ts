declare global {
  interface Window {
    keepboard: import('../../electron/preload').KeepboardAPI
  }
}
export {}
