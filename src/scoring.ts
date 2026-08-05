import { districtBenchmarks } from './data'
import type { Listing, RankedListing, SearchProfile } from './types'
const cityBenchmark = 33_326

export function normalizeCurrency(value?: string): string {
  const currency = (value || 'unknown').trim().toUpperCase()
  if (currency === '$' || currency === 'USD' || currency === 'ДОЛ') return 'USD'
  if (currency === '€' || currency === 'EUR') return 'EUR'
  if (currency === 'ГРН' || currency === 'UAH' || currency === '₴') return 'UAH'
  if (currency.includes('ГРН') || currency.includes('UAH') || currency.includes('₴')) return 'UAH'
  return value || 'unknown'
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function rankListings(listings: Listing[], profile: SearchProfile): RankedListing[] {
  const category = profile.category ?? 'apartment'
  const useHouseRoomFilter = category === 'house'
  const candidates = listings.filter((listing) => useHouseRoomFilter ? listing.rooms === profile.rooms : profile.operation === 'rent' || listing.rooms === profile.rooms).filter((listing) => useHouseRoomFilter ? (listing.area >= profile.minArea && listing.area <= profile.maxArea) : profile.operation === 'rent' || (listing.area >= profile.minArea && listing.area <= profile.maxArea)).filter((listing) => !listing.category || listing.category === category).filter((listing) => profile.operation === 'rent' || profile.propertyType === 'all' || listing.propertyType === profile.propertyType).filter((listing) => profile.renovation === 'all' || (profile.operation === 'rent' && profile.renovation === 'with-renovation') || listing.renovation === profile.renovation).filter((listing) => profile.operation !== 'rent' || normalizeCurrency(listing.currency) === 'UAH').filter((listing) => listing.price <= profile.budget)
  const pricePerMeter = new Map(candidates.map((listing) => [listing.id, listing.price / listing.area]))
  const medianByCurrency = new Map<string, number>()
  for (const listing of candidates) {
    const currency = normalizeCurrency(listing.currency)
    const values = candidates.filter((candidate) => normalizeCurrency(candidate.currency) === currency).map((candidate) => pricePerMeter.get(candidate.id) || 0).filter((value) => value > 0)
    medianByCurrency.set(currency, median(values))
  }
  return candidates.filter((listing) => {
    const current = pricePerMeter.get(listing.id) || 0
    const reference = medianByCurrency.get(normalizeCurrency(listing.currency)) || 0
    // A price below one seventh of comparable listings is treated as a likely currency/data-entry error.
    return profile.operation === 'rent' || reference === 0 || current >= reference / 7
  }).map((listing) => {
    const pricePerMeter = listing.price / listing.area
    const currency = normalizeCurrency(listing.currency)
    const currencyBenchmark = medianByCurrency.get(currency) || cityBenchmark
    const knownBenchmark = profile.operation === 'sale' && currency === 'UAH' ? districtBenchmarks[listing.district] : undefined
    const benchmark = knownBenchmark ?? currencyBenchmark
    const districtCoefficient = benchmark / currencyBenchmark
    const adjustedPricePerMeter = pricePerMeter * districtCoefficient
    const discount = Math.round((1 - pricePerMeter / benchmark) * 100)
    const affordability = Math.max(0, Math.min(35, discount * 1.6 + 15))
    const freshness = Math.max(0, 15 - listing.ageDays)
    const verification = listing.verified ? 15 : 7
    const completeness = listing.condition.includes('ремонт') ? 15 : 10
    const score = Math.round(Math.min(100, affordability + freshness + verification + completeness))
    return { ...listing, pricePerMeter, benchmark, adjustedPricePerMeter, discount, score }
  }).sort((a, b) => b.score - a.score || a.adjustedPricePerMeter - b.adjustedPricePerMeter)
}
