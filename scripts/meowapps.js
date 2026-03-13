#!/usr/bin/env node
import { spawnSync } from 'child_process'

const { status } = spawnSync('node', [`${import.meta.dirname}/${process.argv[2]}.js`, ...process.argv.slice(3)], { stdio: 'inherit' })
process.exit(status ?? 1)
