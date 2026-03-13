import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const claude = resolve(pkg, '.claude')

spawn('claude', [
  '--append-system-prompt-file', `${claude}/CLAUDE.md`,
  '--mcp-config', `${claude}/mcp.json`,
  '--settings', `${claude}/settings.json`,
  ...process.argv.slice(2),
], { stdio: 'inherit' })
