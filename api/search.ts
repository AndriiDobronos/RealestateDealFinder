import type { VercelRequest, VercelResponse } from '@vercel/node'
import stateCatalog from '../state_ID.json' with { type: 'json' }

const DIM_API = 'https://developers.ria.com'
const MAX_DETAILS = 20

type SearchBody = {
  category?: 'apartment' | 'house'
  operation?: 'sale' | 'rent'
  city?: string
  rooms?: number
  minArea?: number
  maxArea?: number
  budget?: number
  propertyType?: 'all' | 'secondary' | 'new-build'
  renovation?: 'all' | 'with-renovation' | 'without-renovation'
}

type DimListing = {
  realty_id?: number
  beautiful_url?: string
  advert_title?: string
  city_name?: string
  district_name?: string
  realty_type_name?: string
  rooms_count?: number | string
  rooms?: number | string
  total_square_meters?: number | string
  area?: number | string
  price_total?: number | string
  price?: number | string
  price_item?: number | string
  currency_type?: string
  floor?: number
  floors_count?: number
  description?: string
  description_uk?: string
  publishing_date?: string
  inspected?: number
  main_photo?: string
  photos?: Record<string, { file?: string }>
  characteristics_values?: Record<string, number | string>
}

type StateRecord = {
  stateID: number
  cityID?: number
  name?: string
  region_name?: string
  center_declension?: string
  translit?: string
  eng_name?: string
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

function normalizeCity(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA').replace(/[’'`-]/g, '').replace(/\s+/g, ' ')
}

function resolveLocation(city?: string): { stateId: string; cityId: string; cityName: string } {
  const requested = normalizeCity(city || 'Харків')
  const aliases: Record<string, string> = {
    'харьков': 'харків',
    'киев': 'київ',
    'львов': 'львів',
    'одесса': 'одеса',
    'днепр': 'дніпро',
    'запорожье': 'запоріжжя',
    'винница': 'вінниця',
    'черновцы': 'чернівці',
    'чернигов': 'чернігів',
    'хмельницкий': 'хмельницький',
    'ивано франковск': 'івано франківськ',
  }
  const target = aliases[requested] ?? requested
  const match = (stateCatalog as StateRecord[]).find((item) => {
    const candidates = [item.region_name, item.center_declension, item.translit, item.eng_name, item.name]
    return candidates.some((candidate) => candidate && normalizeCity(candidate) === target)
  })
  if (!match) {
    const available = (stateCatalog as StateRecord[]).map((item) => item.region_name).filter(Boolean).join(', ')
    throw new Error(`Місто «${city || ''}» не знайдено у state_ID.json. Доступні міста: ${available}`)
  }
  const stateId = String(match.stateID)
  // Обласні центри DIM.RIA мають однакові state_id і city_id.
  // Для Бережан діє окреме правило: Тернопільська область (3), місто (425).
  const specialCityIds: Record<string, string> = {
    [`3:\u0431\u0435\u0440\u0435\u0436\u0430\u043d\u0438`]: '425',
  }
  const cityId = specialCityIds[`${stateId}:${target}`] ?? stateId
  return { stateId, cityId, cityName: match.region_name || city || '' }
}

function classifyRenovation(item: DimListing): 'with-renovation' | 'without-renovation' | 'unknown' {
  if (asNumber(item.characteristics_values?.['1479']) > 0) return 'with-renovation'
  const text = [item.advert_title, item.description_uk, item.description].filter(Boolean).join(' ').toLocaleLowerCase('uk-UA')
  const without = [/без\s+ремонт/, /без\s+оздоблення/, /під\s+ремонт/, /потребує\s+(ремонту|оздоблення)/, /після\s+будівельників/, /чорнов/, /під\s+оздоблення/]
  if (without.some((pattern) => pattern.test(text))) return 'without-renovation'
  const withRepair = [/з\s+ремонт/, /євроремонт/, /капітальн\w*\s+ремонт/, /дизайнерськ\w*\s+ремонт/, /житлов\w*\s+стан/, /готов\w*\s+до\s+заселення/]
  if (withRepair.some((pattern) => pattern.test(text))) return 'with-renovation'
  return 'unknown'
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

function toListing(item: DimListing, propertyType: 'secondary' | 'new-build', category: 'apartment' | 'house') {
  const id = String(item.realty_id ?? '')
  const price = asNumber(item.price_total ?? item.price ?? item.price_item)
  const area = asNumber(item.total_square_meters ?? item.area)
  const mainPhoto = item.main_photo ?? Object.values(item.photos ?? {})[0]?.file
  const condition = item.description?.slice(0, 300) || 'Опис відсутній'
  const renovation = classifyRenovation(item)
  return {
    id: `dim-${id}`,
    title: item.advert_title || `${item.rooms_count ?? ''}-кімнатна квартира`,
    district: item.district_name || 'Район не вказаний',
    category,
    propertyType,
    rooms: asNumber(item.rooms_count ?? item.rooms),
    area,
    price,
    currency: item.currency_type || 'unknown',
    floor: `${item.floor ?? '?'} / ${item.floors_count ?? '?'}`,
    condition,
    renovation,
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
    const body = (req.body ?? {}) as SearchBody
    const operation = body.operation === 'rent' ? 'rent' : 'sale'
    const location = resolveLocation(body.city)
    const rooms = Math.max(1, Math.min(10, asNumber(body.rooms, 2)))
    const minArea = Math.max(1, asNumber(body.minArea, 0))
    const maxArea = Math.max(minArea, asNumber(body.maxArea, 500))
    const searchUrl = new URL(`${DIM_API}/dom/search`)
    searchUrl.searchParams.set('api_key', apiKey)
    const category = body.category === 'house' ? 'house' : 'apartment'
    searchUrl.searchParams.set('category', category === 'house' ? '4' : '1')
    searchUrl.searchParams.set('realty_type', category === 'house' ? '0' : '2')
    searchUrl.searchParams.set('operation_type', operation === 'rent' ? '3' : '1')
    searchUrl.searchParams.set('state_id', location.stateId)
    searchUrl.searchParams.set('city_id', location.cityId)
    searchUrl.searchParams.set('characteristic[209][from]', String(rooms))
    searchUrl.searchParams.set('characteristic[209][to]', String(rooms))
    const areaCharacteristic = category === 'house' ? '215' : '214'
    searchUrl.searchParams.set(`characteristic[${areaCharacteristic}][from]`, String(minArea))
    searchUrl.searchParams.set(`characteristic[${areaCharacteristic}][to]`, String(maxArea))
    if (operation === 'rent') {
      searchUrl.searchParams.set('characteristic[235][from]', '1')
      searchUrl.searchParams.set('characteristic[235][to]', String(Math.max(1, asNumber(body.budget, 100000))))
      searchUrl.searchParams.set('characteristic[246]', '240')
      searchUrl.searchParams.set('sort', 'price_asc')
      if (body.renovation === 'with-renovation') searchUrl.searchParams.set('characteristic[1479]', '1479')
    }

    const search = await getJson<{ items?: number[]; count?: number }>(searchUrl)
    const ids = (search.items ?? []).slice(0, MAX_DETAILS)
    const detailResults = await Promise.allSettled(ids.map(async (id) => {
      const infoUrl = new URL(`${DIM_API}/dom/info/${id}`)
      infoUrl.searchParams.set('api_key', apiKey)
      infoUrl.searchParams.set('lang_id', '4')
      return getJson<DimListing>(infoUrl)
    }))
    const details = detailResults.filter((result): result is PromiseFulfilledResult<DimListing> => result.status === 'fulfilled').map((result) => result.value)
    const propertyType = body.propertyType === 'new-build' ? 'new-build' : 'secondary'
    const listings = details.map((item) => toListing(item, propertyType, category)).filter((item) => item.price > 0 && item.area > 0).filter((item) => body.renovation === 'all' || !body.renovation || item.renovation === body.renovation || (operation === 'rent' && body.renovation === 'with-renovation'))
    const currencyCounts = listings.reduce<Record<string, number>>((counts, listing) => { const currency = listing.currency || 'unknown'; counts[currency] = (counts[currency] || 0) + 1; return counts }, {})
    return res.status(200).json({ source: 'dim-ria', operation, location, total: search.count ?? listings.length, listings, diagnostics: { searchCount: search.count ?? 0, idsReceived: ids.length, detailsReceived: details.length, validListings: listings.length, detailsFailed: detailResults.length - details.length, currencyCounts } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Невідома помилка сервера'
    const status = message.includes('Не налаштовано') ? 503 : 502
    return res.status(status).json({ error: message })
  }
}
