export type PropertyType = 'secondary' | 'new-build'
export type RealtyCategory = 'apartment' | 'house'
export type Operation = 'sale' | 'rent'
export type RenovationPreference = 'all' | 'with-renovation' | 'without-renovation'
export type RenovationStatus = 'with-renovation' | 'without-renovation' | 'unknown'
export type Listing = { id: string; title: string; district: string; category?: RealtyCategory; propertyType: PropertyType; rooms: number; area: number; price: number; currency?: string; floor: string; condition: string; renovation?: RenovationStatus; ageDays: number; verified: boolean; image: string; url: string }
export type SearchProfile = { operation: Operation; city: string; category?: RealtyCategory; rooms: number; minArea: number; maxArea: number; propertyType: 'all' | PropertyType; renovation: RenovationPreference; budget: number }
export type RankedListing = Listing & { pricePerMeter: number; benchmark: number; adjustedPricePerMeter: number; discount: number; score: number }
