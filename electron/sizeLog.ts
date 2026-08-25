// Centralised window-size change journal.
// Every real (deduped) resize is recorded with its source so that abnormal
// growth is immediately attributable instead of mysterious.
const entries: string[] = []
const MAX = 20

export function logSize(source: string, b: { width: number; height: number; x: number; y: number }) {
  const t = new Date()
  const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
  entries.unshift(`${ts} [${source}] ${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x)},${Math.round(b.y)})`)
  if (entries.length > MAX) entries.pop()
}

export function getSizeLog(): string[] {
  return [...entries]
}

export function rectsClose(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  tol = 1
): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.width - b.width) <= tol &&
    Math.abs(a.height - b.height) <= tol
  )
}
