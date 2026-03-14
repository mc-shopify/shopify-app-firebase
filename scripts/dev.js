#!/usr/bin/env node
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import { builder } from './build.js'

const { dist, handlers } = builder.config()

// Build app, install deps, start emulators, watch for changes
execSync(`node ${import.meta.dirname}/build.js`, { stdio: 'inherit' })
execSync('npm i', { cwd: dist, stdio: 'pipe' })
const emu = spawn('npm', ['run', 'dev', '--', '--log-verbosity', 'SILENT'], { cwd: dist, stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
// Skip startup noise, pass through runtime logs after Issues? line
let passthrough = false
const filter = chunk => {
  for (const line of chunk.toString().split('\n')) {
    if (!line.trim()) continue
    if (line.includes('Issues?')) { passthrough = true; continue }
    if (passthrough && !/Using node@|Serving at port/.test(line)) process.stdout.write(line.replace(/\[.*?\]\s*/g, '') + '\n')
  }
}
emu.stdout.on('data', filter)
emu.stderr.on('data', filter)
watch(handlers)

// ---------------------------------------------------------------------------

// Rebuild individual files on change — only files matching handler patterns
function watch(handlers) {
  fs.watch('src', (_, f) => {
    if (!f || !handlers.some(h => f.startsWith(h.type + '.') && f.endsWith(h.ext))) return
    execSync(`node ${import.meta.dirname}/build.js src/${f}`, { stdio: 'inherit' })
  })
}
