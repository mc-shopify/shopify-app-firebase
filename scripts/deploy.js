#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'
import { builder } from './build.js'

const { dist } = builder.config()

// Deploy extensions, then build + deploy web to Firebase
execSync(`npx shopify app deploy ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' })
execSync(`node ${import.meta.dirname}/build.js`, { stdio: 'inherit' })
execSync('npm i', { cwd: dist, stdio: 'pipe' })
const env = execSync('npx shopify app env show', { encoding: 'utf8' })
const secret = env.match(/SHOPIFY_API_SECRET=(\S+)/)?.[1]
if (!secret) throw new Error('SHOPIFY_API_SECRET not found')
fs.writeFileSync(`${dist}/functions/.env`, `SHOPIFY_API_SECRET=${secret}\n`)
execSync('npm run deploy', { cwd: dist, stdio: 'inherit' })
