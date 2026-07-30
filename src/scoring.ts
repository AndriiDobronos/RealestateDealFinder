import { districtBenchmarks } from './data'
import type { Listing, RankedListing, SearchProfile } from './types'
const cityBenchmark = 33_326

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function rankListings(listings: Listing[], profile: SearchProfile): RankedListing[] {
  const candidates = listings.filter((listing) => listing.rooms === profile.rooms).filter((listing) => listing.area >= profile.minArea && listing.area <= profile.maxArea).filter((listing) => profile.propertyType === 'all' || listing.propertyType === profile.propertyType).filter((listing) => listing.price <= profile.budget)
  const pricePerMeter = new Map(candidates.map((listing) => [listing.id, listing.price / listing.area]))
  const medianByCurrency = new Map<string, number>()
  for (const listing of candidates) {
    const currency = listing.currency || 'unknown'
    const values = candidates.filter((candidate) => (candidate.currency || 'unknown') === currency).map((candidate) => pricePerMeter.get(candidate.id) || 0).filter((value) => value > 0)
    medianByCurrency.set(currency, median(values))
  }
  return candidates.filter((listing) => {
    const current = pricePerMeter.get(listing.id) || 0
    const reference = medianByCurrency.get(listing.currency || 'unknown') || 0
    // A price below one seventh of comparable listings is treated as a likely currency/data-entry error.
    return reference === 0 || current >= reference / 7
  }).map((listing) => {
    const pricePerMeter = listing.price / listing.area
    const benchmark = districtBenchmarks[listing.district] ?? cityBenchmark
    const districtCoefficient = benchmark / cityBenchmark
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
