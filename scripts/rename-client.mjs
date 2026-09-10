/** Rename the tsdown cjs client artifact to the exports["./client"] target. */
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

renameSync('lib/client.cjs', 'lib/client.js')
try {
  renameSync('lib/client.cjs.map', 'lib/client.js.map')
} catch {
  // map optional
}
const file = 'lib/client.js'
writeFileSync(file, readFileSync(file, 'utf8').replace('client.cjs.map', 'client.js.map'))
console.log('[dsh-link-collect] client artifact -> lib/client.js')
