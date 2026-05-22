require('dotenv').config({ path: './.env' })
const url = String(process.env.DATABASE_URL || '')
const normalized = url.trim().replace(/^"|"$/g, '')
const path = normalized.replace(/^file:\/\//, '').replace(/^file:/, '')
const resolved = require('path').resolve(__dirname, '..', path.replace(/^\.\//, ''))
console.log('raw:', process.env.DATABASE_URL)
console.log('normalized:', normalized)
console.log('resolved path:', resolved)
try{
  const fs = require('fs')
  console.log('exists:', fs.existsSync(resolved))
  console.log('size:', fs.existsSync(resolved) ? fs.statSync(resolved).size : 'n/a')
}catch(e){console.error(e)}
