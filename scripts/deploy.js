#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'
import { builder } from './build.js'

const { dist } = builder.config()

const steps = [
  ['Building...', () => execSync(`node ${import.meta.dirname}/build.js`, { stdio: 'inherit' })],
  ['Installing deps...', () => execSync('npm i', { cwd: dist, stdio: 'inherit' })],
  ['Getting SHOPIFY_API_SECRET...', () => getSecret()],
  ['Writing functions .env...', secret => fs.writeFileSync(`${dist}/functions/.env`, `SHOPIFY_API_SECRET=${secret}\n`)],
  ['Deploying Shopify app config...', () => execSync('shopify app deploy --force', { stdio: 'inherit' })],
  ['Deploying to Firebase...', () => execSync('npm run deploy', { cwd: dist, stdio: 'inherit' })],
]

let result
for (let i = 0; i < steps.length; i++) {
  console.log(`\n\x1b[1m[${i + 1}/${steps.length}] ${steps[i][0]}\x1b[0m`)
  result = steps[i][1](result)
}

// ---------------------------------------------------------------------------

// May prompt for Shopify login if not authenticated
function getSecret() {
  const out = execSync('shopify app env show', { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] })
  return out.match(/SHOPIFY_API_SECRET=(\S+)/)?.[1] || ''
}
