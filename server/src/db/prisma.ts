import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'url'

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var prismaClient: PrismaClient | undefined
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_ROOT = resolve(__dirname, '..')

function normalizeDatabaseUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim().replace(/^"|"$/g, '')
  if (!trimmedUrl) {
    // Development-friendly fallback: use a local SQLite DB when DATABASE_URL
    // is not set. In production we still require a proper DATABASE_URL.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[startup] DATABASE_URL is required and must not be empty.')
    }

    console.warn('[prisma] DATABASE_URL not set. Falling back to SQLite dev DB at ./prisma/dev.db')
    return 'file:./prisma/dev.db'
  }

  if (!trimmedUrl.toLowerCase().startsWith('file:')) {
    return trimmedUrl
  }

  const filePath = trimmedUrl.slice(5)
  if (!filePath) {
    throw new Error('[startup] DATABASE_URL points to SQLite but the file path is missing.')
  }

  const normalizedPath = filePath.replace(/^\.\//, '')
  const resolvedPath = resolve(SERVER_ROOT, normalizedPath)
  const dir = dirname(resolvedPath)
  mkdirSync(dir, { recursive: true })

  return `file:${resolvedPath}`
}

const databaseUrl = normalizeDatabaseUrl(String(process.env.DATABASE_URL || ''))
const isSqlite = databaseUrl.toLowerCase().startsWith('file:')
const isPostgres = databaseUrl.toLowerCase().startsWith('postgres://') || databaseUrl.toLowerCase().startsWith('postgresql://')

const createPrismaClient = () => {
  return new PrismaClient({
    log: ['warn', 'error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

const prismaBase = globalThis.prismaClient ?? createPrismaClient()
if (!globalThis.prismaClient) {
  globalThis.prismaClient = prismaBase
}

const SOFT_DELETE_MODELS = new Set([
  'School',
  'User',
  'Staff',
  'Student',
  'Class',
  'Subject',
  'Enrollment',
  'Attendance',
  'Notice',
  'Fee',
  'Result',
])

const RETRYABLE_PRISMA_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1010',
  'P1012',
  'P2012',
  'P2013',
])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientPrismaError(error: unknown) {
  const message = String((error as any)?.message || '').toLowerCase()
  const code = String((error as any)?.code || '').toUpperCase()
  const name = String((error as any)?.name || '').toLowerCase()

  if (RETRYABLE_PRISMA_CODES.has(code)) {
    return true
  }

  if (name.includes('prismaclientinitializationerror')) {
    return true
  }

  if (message.includes('sqlite_busy') || message.includes('sqlite_locked') || message.includes('database is locked')) {
    return true
  }

  if (message.includes('disk i/o error') || message.includes('database disk image is malformed')) {
    return true
  }

  return false
}

function isDatabaseConnectivityError(error: unknown) {
  const message = String((error as any)?.message || '').toLowerCase()
  const code = String((error as any)?.code || '').toLowerCase()
  const name = String((error as any)?.name || '').toLowerCase()

  return (
    code.includes('p1001') ||
    code.includes('p1002') ||
    name.includes('prismaclientinitializationerror') ||
    message.includes('database connection failed') ||
    message.includes('connect') ||
    message.includes('timeout')
  )
}

async function runSqlitePragmas(client: PrismaClient) {
  if (!isSqlite) {
    return
  }

  await client.$queryRawUnsafe('PRAGMA foreign_keys = ON;')
  await client.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
  await client.$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
  await client.$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
}

let connected = false

export async function verifyPrismaConnection(retries = 2) {
  const attemptConnect = async (attempt: number): Promise<void> => {
    try {
      if (!connected) {
        await prismaBase.$connect()
        await runSqlitePragmas(prismaBase)
        connected = true
      }
      await prismaBase.$queryRawUnsafe('SELECT 1')
    } catch (error) {
      if (attempt < retries && isTransientPrismaError(error)) {
        await sleep(200 * attempt)
        return attemptConnect(attempt + 1)
      }
      throw error
    }
  }

  return attemptConnect(1)
}

export async function disconnectPrisma() {
  try {
    if (connected) {
      await prismaBase.$disconnect()
      connected = false
    }
  } catch (error) {
    console.error('[prisma] Failed to disconnect cleanly:', error)
  }
}

export async function getPrismaHealth() {
  try {
    await verifyPrismaConnection(1)
    return {
      status: 'online',
      healthy: true,
      database: isSqlite ? 'sqlite' : isPostgres ? 'postgresql' : 'unknown',
      connected: true,
      timestamp: new Date().toISOString(),
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      healthy: false,
      connected: false,
      message: error?.message || 'Unable to query the database',
      timestamp: new Date().toISOString(),
    }
  }
}

function shouldRetryQuery(error: unknown) {
  return isTransientPrismaError(error)
}

const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const mutableArgs = (args ?? {}) as Record<string, any>

        const softDeleteOperations = [
          'findMany',
          'findFirst',
          'findFirstOrThrow',
          'count',
          'aggregate',
          'groupBy',
        ]

        if (softDeleteOperations.includes(operation) && SOFT_DELETE_MODELS.has(model)) {
          mutableArgs.where = { ...(mutableArgs.where || {}), deletedAt: null }
        }

        let attempt = 0
        while (true) {
          try {
            return await query(mutableArgs)
          } catch (error) {
            attempt += 1
            if (attempt > 1 || !shouldRetryQuery(error)) {
              throw error
            }
            console.warn('[prisma] Transient DB error detected, attempting reconnect and retry:', {
              model,
              operation,
              error: String((error as any)?.message || error),
            })
            await verifyPrismaConnection()
            await sleep(250)
          }
        }
      },
    },
  },
})

export function isPrismaDatabaseError(error: unknown) {
  return isDatabaseConnectivityError(error) || isTransientPrismaError(error)
}

export default prisma
