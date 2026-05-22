/**
 * Central API configuration.
 * - If VITE_API_URL is provided, use it.
 * - Otherwise default to same-origin so Vite proxy (dev) or reverse proxy (prod) can handle `/api`.
 */
const configuredApiBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

export const API_BASE = configuredApiBase || ''
