import { districtBenchmarks } from './data'
import type { Listing, RankedListing, SearchProfile } from './types'
const cityBenchmark = 33_326
export function rankListings(listings: Listing[], profile: SearchProfile): RankedListing[] {
  return listings.filter((listing) => listing.rooms === profile.rooms).filter((listing) => listing.area >= profile.minArea && listing.area <= profile.maxArea).filter((listing) => profile.propertyType === 'all' || listing.propertyType === profile.propertyType).filter((listing) => listing.price <= profile.budget).map((listing) => {
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
