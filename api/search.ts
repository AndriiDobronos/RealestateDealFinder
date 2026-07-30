import type { VercelRequest, VercelResponse } from '@vercel/node'

const DIM_API = 'https://developers.ria.com'
const MAX_DETAILS = 10

type SearchBody = {
  city?: string
  rooms?: number
  minArea?: number
  maxArea?: number
  budget?: number
  propertyType?: 'all' | 'secondary' | 'new-build'
}

type DimListing = {
  realty_id?: number
  beautiful_url?: string
  advert_title?: string
  city_name?: string
  district_name?: string
  realty_type_name?: string
  rooms_count?: number
  total_square_meters?: number
  price_total?: number
  price?: number
  price_item?: number
  currency_type?: string
  floor?: number
  floors_count?: number
  description?: string
  publishing_date?: string
  inspected?: number
  main_photo?: string
  photos?: Record<string, { file?: string }>
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Не налаштовано змінну середовища ${name}`)
  return value
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function dateAge(date?: string): number {
  if (!date) return 30
  const timestamp = Date.parse(date.replace(' ', 'T'))
  if (!Number.isFinite(timestamp)) return 30
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
}

function photoUrl(photo?: string): string {
  if (!photo) return ''
  const normalized = photo.replace(/^\/+/, '').replace(/\.jpg$/i, 'xl.jpg')
  return normalized.startsWith('http') ? normalized : `https://cdn.riastatic.com/photos/${normalized}`
}

function toListing(item: DimListing, propertyType: 'secondary' | 'new-build') {
  const id = String(item.realty_id ?? '')
  const price = asNumber(item.price_total ?? item.price)
  const area = asNumber(item.total_square_meters)
  const mainPhoto = item.main_photo ?? Object.values(item.photos ?? {})[0]?.file
  return {
    id: `dim-${id}`,
    title: item.advert_title || `${item.rooms_count ?? ''}-кімнатна квартира`,
    district: item.district_name || 'Район не вказаний',
    propertyType,
    rooms: asNumber(item.rooms_count),
    area,
    price,
    floor: `${item.floor ?? '?'} / ${item.floors_count ?? '?'}`,
    condition: item.description?.slice(0, 80) || 'Опис відсутній',
    ageDays: dateAge(item.publishing_date),
    verified: item.inspected === 1,
    image: photoUrl(mainPhoto),
    url: item.beautiful_url ? `https://dom.ria.com/uk/${item.beautiful_url.replace(/^\/+/, '')}` : `https://dom.ria.com/uk/`,
  }
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 429) throw new Error('DIM.RIA тимчасово обмежив кількість API-запитів')
    throw new Error(`DIM.RIA API повернув HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Потрібен POST-запит' })

  try {
    const apiKey = requiredEnv('DIM_RIA_API_KEY')
    const stateId = requiredEnv('DIM_RIA_STATE_ID')
    const cityId = requiredEnv('DIM_RIA_CITY_ID')
    const body = (req.body ?? {}) as SearchBody
    const rooms = Math.max(1, Math.min(10, asNumber(body.rooms, 2)))
    const minArea = Math.max(1, asNumber(body.minArea, 0))
    const maxArea = Math.max(minArea, asNumber(body.maxArea, 500))
    const searchUrl = new URL(`${DIM_API}/dom/search`)
    searchUrl.searchParams.set('api_key', apiKey)
    searchUrl.searchParams.set('category', '1')
    searchUrl.searchParams.set('realty_type', '2')
    searchUrl.searchParams.set('operation_type', '1')
    searchUrl.searchParams.set('state_id', stateId)
    searchUrl.searchParams.set('city_id', cityId)
    searchUrl.searchParams.set('characteristic[209][from]', String(rooms))
    searchUrl.searchParams.set('characteristic[209][to]', String(rooms))
    searchUrl.searchParams.set('characteristic[214][from]', String(minArea))
    searchUrl.searchParams.set('characteristic[214][to]', String(maxArea))

    const search = await getJson<{ items?: number[]; count?: number }>(searchUrl)
    const ids = (search.items ?? []).slice(0, MAX_DETAILS)
    const details = await Promise.all(ids.map(async (id) => {
      const infoUrl = new URL(`${DIM_API}/dom/info/${id}`)
      infoUrl.searchParams.set('api_key', apiKey)
      infoUrl.searchParams.set('lang_id', '4')
      return getJson<DimListing>(infoUrl)
    }))
    const propertyType = body.propertyType === 'new-build' ? 'new-build' : 'secondary'
    const listings = details.map((item) => toListing(item, propertyType)).filter((item) => item.price > 0 && item.area > 0)
    return res.status(200).json({ source: 'dim-ria', total: search.count ?? listings.length, listings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Невідома помилка сервера'
    const status = message.includes('Не налаштовано') ? 503 : 502
    return res.status(status).json({ error: message })
  }
}
