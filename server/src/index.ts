import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
import { createServer } from 'net';
import 'dotenv/config';

// Defer importing Prisma until after we apply any dev environment defaults
// so that the client is initialized with the correct `DATABASE_URL`.
let prisma: any;
let disconnectPrisma: any;
let getPrismaHealth: any;
let verifyPrismaConnection: any;
let isPrismaDatabaseError: any;

async function loadPrisma() {
  const mod = await import('./db/prisma.js');
  prisma = mod.default;
  disconnectPrisma = mod.disconnectPrisma;
  getPrismaHealth = mod.getPrismaHealth;
  verifyPrismaConnection = mod.verifyPrismaConnection;
  isPrismaDatabaseError = mod.isPrismaDatabaseError;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. NODE_ENV GUARD
// ─────────────────────────────────────────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.NODE_ENV) {
  console.warn('⚠️  NODE_ENV not set. Defaulting to development.');
}

const IS_PRODUCTION = NODE_ENV === 'production';

// Allow sensible defaults in development to make local startup easier.
// In production we keep strict validation.
if (!process.env.DATABASE_URL) {
  if (IS_PRODUCTION) {
    throw new Error('[startup] DATABASE_URL is required in production. Set it in .env or your deployment environment.');
  }

  console.warn('[startup] DATABASE_URL not set. Falling back to SQLite dev DB at ./prisma/dev.db');
  process.env.DATABASE_URL = 'file:./prisma/dev.db'
}
const DATABASE_URL = process.env.DATABASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// 2. JWT SECRET VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error('[startup] JWT_SECRET is required in production. Refusing to start without a configured secret.');
  }

  // Development fallback — warn and provide a non-blank secret so JWT plugin initializes.
  console.warn('[startup] JWT_SECRET not set. Using development fallback secret. Do NOT use in production.');
  JWT_SECRET = process.env.JWT_SECRET = 'dev_jwt_secret_please_change_in_production_123456';
}

if (IS_PRODUCTION && JWT_SECRET.length < 32) {
  throw new Error(
    `[startup] JWT_SECRET is too weak for production (${JWT_SECRET.length} chars). ` +
    'Minimum 32 characters required. Generate one with: openssl rand -hex 32'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAYSTACK VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL;

// Paystack is optional in development — do not block startup when missing.
if (!PAYSTACK_SECRET_KEY && IS_PRODUCTION) {
  throw new Error('[startup] PAYSTACK_SECRET_KEY is required in production. Refusing to start without Paystack credentials.');
}

if (IS_PRODUCTION && !PAYSTACK_CALLBACK_URL) {
  throw new Error('[startup] PAYSTACK_CALLBACK_URL is required in production for safe Paystack redirects.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CORS VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
if (IS_PRODUCTION && !process.env.CORS_ORIGIN) {
  throw new Error(
    '[startup] CORS_ORIGIN is required in production. ' +
    'Set it to your frontend URL, e.g. CORS_ORIGIN=https://yourapp.com'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FASTIFY INSTANCE
// ─────────────────────────────────────────────────────────────────────────────
const hasPinoPretty = (() => {
  try {
    require.resolve('pino-pretty')
    return true
  } catch {
    return false
  }
})()

const fastify = Fastify({
  logger: IS_PRODUCTION
    ? { level: 'info' }
    : hasPinoPretty
      ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
      : { level: 'info' },
});

async function checkPortAvailable(startPort: number) {
  const maxAttempts = 10
  let attemptPort = startPort

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await new Promise<number | null>((resolve, reject) => {
      const server = createServer()
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(null)
        } else {
          reject(err)
        }
      })
      server.once('listening', () => {
        server.close(() => resolve(attemptPort))
      })
      server.listen(attemptPort, '0.0.0.0')
    })

    if (available) {
      return available
    }

    if (IS_PRODUCTION) {
      throw new Error(`[startup] Port ${attemptPort} is already in use. Choose another PORT or stop the running instance.`)
    }

    // try the next port in development
    attemptPort += 1
    console.warn(`[startup] Port ${attemptPort - 1} is busy. Trying ${attemptPort}...`)
  }

  throw new Error('[startup] Failed to find an available port after multiple attempts.')
}

function mapFastifyError(error: any) {
  if (isPrismaDatabaseError(error)) {
    return {
      statusCode: 503,
      error: 'Database temporarily unavailable. Please retry in a moment.',
    }
  }

  if (error?.validation) {
    return {
      statusCode: 400,
      error: error.message || 'Validation failed',
    }
  }

  if (error?.statusCode && error?.message) {
    return {
      statusCode: error.statusCode,
      error: error.message,
    }
  }

  return {
    statusCode: 500,
    error: 'Internal server error',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CORS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN;

  if (!configured) {
    // Dev fallback — IS_PRODUCTION guard above already throws before reaching here
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isDevelopmentLocalOrigin(origin: string): boolean {
  if (IS_PRODUCTION) return false;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  } catch {
    return false;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROUTE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import dashboardRoutes from './routes/dashboard.js';
import principalRoutes from './routes/principal.js';
import teacherRoutes from './routes/teacher.js';
import studentRoutes from './routes/student.js';
import classRoutes from './routes/class.js';
import subjectRoutes from './routes/subject.js';
import attendanceRoutes from './routes/attendance.js';
import noticeRoutes from './routes/notice.js';
import feeRoutes from './routes/fee.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notification.js';
import supportRoutes from './routes/support.js';
import teacherDashboardRoutes from './routes/teacher-dashboard.js';
import resultRoutes from './routes/result.js';
import marketingRoutes from './routes/marketing.js';
import adminRoutes from './modules/admin/admin.routes.js';
import fileRoutes from './routes/files.js';
import { isSmtpConfigured, verifyMailTransport } from './utils/mail.js';
import { ensureLocalPlatformAdmin } from './utils/dev-admin.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { subscriptionAccessGuard } from './middleware/subscription-access.js';

// ─────────────────────────────────────────────────────────────────────────────
// 8. INIT — register plugins and routes
// ─────────────────────────────────────────────────────────────────────────────
async function init() {
  const allowedOrigins = getAllowedOrigins();

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      if (isDevelopmentLocalOrigin(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error('Origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(jwt, {
    secret: JWT_SECRET as string,
  });

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled request error');
    const mapped = mapFastifyError(error)
    reply.status(mapped.statusCode).send({ error: mapped.error })
  })

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'Route not found' })
  })

  // Global middleware — tenant context + subscription gating
  // tenantMiddleware must run early (onRequest) so route-level onRequest hooks can read `request.user`
  fastify.addHook('onRequest', tenantMiddleware);
  fastify.addHook('preHandler', subscriptionAccessGuard);

  await fastify.register(fastifyMultipart);

  // Protected file serving (tenant-aware, not static public)
  fastify.register(fileRoutes, { prefix: '/api/uploads' });

  // Application routes
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(paymentRoutes, { prefix: '/api/payments' });
  fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  fastify.register(principalRoutes, { prefix: '/api/principals' });
  fastify.register(teacherRoutes, { prefix: '/api/teachers' });
  fastify.register(studentRoutes, { prefix: '/api/students' });
  fastify.register(classRoutes, { prefix: '/api/classes' });
  fastify.register(subjectRoutes, { prefix: '/api/subjects' });
  fastify.register(attendanceRoutes, { prefix: '/api/attendance' });
  fastify.register(noticeRoutes, { prefix: '/api/notices' });
  fastify.register(feeRoutes, { prefix: '/api/fees' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });
  fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  fastify.register(supportRoutes, { prefix: '/api/support' });
  fastify.register(adminRoutes, { prefix: '/api/admin' });
  fastify.register(teacherDashboardRoutes, { prefix: '/api/teacher' });
  fastify.register(resultRoutes, { prefix: '/api/results' });
  fastify.register(marketingRoutes, { prefix: '/api' });

  // Health check — enriched for production monitoring
  fastify.get('/api/health', async (_request, reply) => {
    const dbHealth = await getPrismaHealth()
    const body = {
      success: dbHealth.healthy,
      server: dbHealth.healthy ? 'online' : 'degraded',
      database: dbHealth.connected ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      detail: dbHealth,
    }

    return reply.status(dbHealth.healthy ? 200 : 503).send(body)
  });
}

async function verifyDatabaseConnection() {
  try {
    await verifyPrismaConnection()
    console.log('[startup] Database connection verified.');
  } catch (error) {
    console.error('[startup] Database connection failed:', error);
    throw new Error('[startup] Database connection failed. Check DATABASE_URL and Prisma setup.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[shutdown] Received ${signal}. Shutting down server...`);
  try {
    await fastify.close();
    await disconnectPrisma();
    console.log('[shutdown] Server closed cleanly. Goodbye.');
    process.exit(0);
  } catch (err) {
    console.error('[shutdown] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  console.error('[startup] uncaughtException:', error)
  shutdown('uncaughtException')
})
process.on('unhandledRejection', (reason) => {
  console.error('[startup] unhandledRejection:', reason)
  shutdown('unhandledRejection')
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. START
// ─────────────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await loadPrisma();
    await verifyDatabaseConnection();
    await init();

    // Bootstrap dev admin (no-op in production). Do not block server startup if local Prisma
    // engine is unavailable on this machine (e.g., Windows EPERM in OneDrive workspace).
    try {
      await ensureLocalPlatformAdmin();
    } catch (bootstrapError) {
      console.warn('[startup] Dev admin bootstrap skipped:', bootstrapError);
    }

    const initialPort = parseInt(process.env.PORT || '5000', 10);
    const chosenPort = await checkPortAvailable(initialPort) || initialPort
    await fastify.listen({ port: chosenPort, host: '0.0.0.0' });
    console.log(`[startup] ✅ Server listening on http://0.0.0.0:${chosenPort} (${NODE_ENV})`);
    console.log('[startup] Health endpoint active at /api/health');
    console.log('[startup] Routes loaded:');
    fastify.printRoutes({ commonPrefix: true });
    console.log('[startup] API base is /api for frontend proxy support');

    if (!IS_PRODUCTION) {
      if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
        console.log('[startup] SUPERADMIN bootstrap is enabled via SUPERADMIN_EMAIL.');
      } else {
        console.log('[startup] SUPERADMIN bootstrap is disabled (set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD to enable).');
      }
    }

    // SMTP check — non-fatal, warn on failure
    try {
      await verifyMailTransport();
      if (isSmtpConfigured()) {
        console.log('[startup] ✅ SMTP connection verified.');
      } else {
        console.warn('[startup] ⚠️  SMTP not configured. OTP emails will use dev transport (logged only).');
      }
    } catch (smtpError) {
      console.error('[startup] ❌ SMTP verification failed:', smtpError);
    }
  } catch (err) {
    console.error('[startup] ❌ Fatal error during startup:', err);
    process.exit(1);
  }
};

start();
