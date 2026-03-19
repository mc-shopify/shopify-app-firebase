#!/usr/bin/env node
import { spawn, execSync } from 'child_process'
import fs from 'fs'

if (process.argv.includes('--only-web')) {
  // Called by Shopify CLI via shopify.web.toml — build + emulators + watch
  const { builder } = await import('./build.js')
  const { dist, handlers } = builder.config()
  execSync('npm run build', { stdio: 'inherit' })
  execSync('npm i', { cwd: dist, stdio: 'pipe' })
  spawn('npm', ['run', 'dev', '--', '--project', 'demo-meowapps'], { cwd: dist, stdio: 'inherit', env: process.env })
  watch(handlers)
} else {
  // Ensure shopify.web.toml exists (Shopify CLI requires it at project root)
  fs.copyFileSync(import.meta.dirname + '/../shopify.web.toml', 'shopify.web.toml')
  execSync(`npx shopify app dev ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' })
}

// ---------------------------------------------------------------------------

// Rebuild individual files on change — only files matching handler patterns
function watch(handlers) {
  fs.watch('src', (_, f) => {
    if (!f || !handlers.some(h => f.startsWith(h.type + '.') && f.endsWith(h.ext))) return
    execSync(`npm run build -- src/${f}`, { stdio: 'inherit' })
  })
}
