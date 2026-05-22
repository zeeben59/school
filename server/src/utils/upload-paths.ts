import fs from 'fs'
import path from 'path'

const configuredBaseDir = process.env.UPLOADS_BASE_DIR?.trim()
const PUBLIC_DIR = configuredBaseDir
  ? path.resolve(configuredBaseDir)
  : path.resolve(process.cwd(), 'public')
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads')
const RESULT_DOCUMENTS_DIR = path.join(UPLOADS_DIR, 'result-documents')

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export function getUploadsDirectory() {
  ensureDirectory(UPLOADS_DIR)
  return UPLOADS_DIR
}

export function getResultDocumentsDirectory() {
  ensureDirectory(RESULT_DOCUMENTS_DIR)
  return RESULT_DOCUMENTS_DIR
}
