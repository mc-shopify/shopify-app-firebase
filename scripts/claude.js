import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const claude = resolve(pkg, '.claude')

const { status } = spawnSync('claude', [
  '--append-system-prompt-file', `${claude}/developer.md`,
  '--mcp-config', `${claude}/mcp.json`,
  '--settings', `${claude}/settings.json`,
  '--add-dir', pkg,
  ...process.argv.slice(2),
], { stdio: 'inherit', env: { ...process.env, CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1' } })
process.exit(status ?? 1)
