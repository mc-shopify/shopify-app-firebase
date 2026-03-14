#!/usr/bin/env node
import fs from 'fs'
import { execSync } from 'child_process'

for (const p of ['node_modules', 'package-lock.json', 'dist']) fs.rmSync(p, { recursive: true, force: true })
execSync('npm i', { stdio: 'inherit' })
