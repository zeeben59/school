/**
 * Central API configuration.
 * - If VITE_API_URL is provided, use it.
 * - In development, fallback to same-origin so Vite proxy can handle `/api`.
 * - In production, VITE_API_URL should be explicitly configured to avoid SPA HTML fallback responses.
 */
const configuredApiBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

export const API_BASE = configuredApiBase || (import.meta.env.DEV ? '' : '')
export const IS_API_BASE_CONFIGURED = Boolean(configuredApiBase)

if (import.meta.env.PROD && !configuredApiBase) {
  console.error('[config] Missing VITE_API_URL in production. API calls to /api/* may fail or return non-JSON responses.')
}
