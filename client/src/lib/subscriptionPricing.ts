export const TERM_PRICE_FALLBACK_NAIRA: Record<string, number> = {
  'First Term': 75000,
  'Second Term': 100000,
  'Third Term': 110000,
}
export const SCHOOL_TRIAL_DAYS_FALLBACK = 7
export const SUBSCRIPTION_TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'] as const
export const REGISTRATION_FEE_FALLBACK_NAIRA = 5000

export function getTermPriceNaira(termName: string, serverPrices?: Record<string, number>) {
  if (serverPrices && typeof serverPrices[termName] === 'number') {
    return serverPrices[termName]
  }

  return TERM_PRICE_FALLBACK_NAIRA[termName] || TERM_PRICE_FALLBACK_NAIRA['First Term']
}
