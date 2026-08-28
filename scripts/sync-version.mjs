/**
 * Read scripts/version.txt and write the version into package.json.
 * Run: node scripts/sync-version.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const rawVer = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim()
// The source file follows the user-facing `v0.14.0` convention; package.json
// requires plain SemVer, so only the optional leading v is removed on sync.
const ver = rawVer.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error(`invalid version in scripts/version.txt: "${rawVer}"`)
  process.exit(1)
}
const pkgPath = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
if (pkg.version === ver) {
  console.log(`package.json version already ${ver} — no change`)
} else {
  pkg.version = ver
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`package.json version → ${ver}`)
}
