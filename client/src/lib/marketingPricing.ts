import { SCHOOL_TRIAL_DAYS_FALLBACK, SUBSCRIPTION_TERM_OPTIONS, TERM_PRICE_FALLBACK_NAIRA } from './subscriptionPricing'

export type MarketingPricingTerm = {
  termName: string
  amount: number
}

export type MarketingPricingPayload = {
  trialDays: number
  currency: string
  terms: MarketingPricingTerm[]
}

export const MARKETING_PRICING_FALLBACK: MarketingPricingPayload = {
  trialDays: SCHOOL_TRIAL_DAYS_FALLBACK,
  currency: 'NGN',
  terms: SUBSCRIPTION_TERM_OPTIONS.map((termName) => ({
    termName,
    amount: TERM_PRICE_FALLBACK_NAIRA[termName],
  })),
}

