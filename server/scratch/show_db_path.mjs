import dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync, statSync } from 'fs'

dotenv.config({ path: './.env' })
const url = String(process.env.DATABASE_URL || '')
const normalized = url.trim().replace(/^"|"$/g, '')
const path = normalized.replace(/^file:\/\//, '').replace(/^file:/, '')
const resolved = resolve('.', path.replace(/^\.\//, ''))
console.log('raw:', process.env.DATABASE_URL)
console.log('normalized:', normalized)
console.log('resolved path:', resolved)
console.log('exists:', existsSync(resolved))
console.log('size:', existsSync(resolved) ? statSync(resolved).size : 'n/a')
