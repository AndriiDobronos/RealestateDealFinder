import { useMemo, useState } from 'react'
import { Bell, ChevronDown, ExternalLink, Filter, Heart, Info, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import { demoListings, initialProfile } from './data'
import { rankListings } from './scoring'
import type { Listing, PropertyType, SearchProfile } from './types'
const money = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
function App() {
  const [profile, setProfile] = useState<SearchProfile>(initialProfile)
  const [listings, setListings] = useState<Listing[]>(demoListings)
  const [saved, setSaved] = useState<string[]>([])
  const [updated, setUpdated] = useState('сьогодні о 08:00')
  const [loading, setLoading] = useState(false)
  const [apiMessage, setApiMessage] = useState('Демо-дані підключені')
  const results = useMemo(() => rankListings(listings, profile), [listings, profile])
  const best = results[0]
  const update = <K extends keyof SearchProfile>(key: K, value: SearchProfile[K]) => setProfile((current) => ({ ...current, [key]: value }))
  const runSearch = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
      const payload = await response.json() as { listings?: Listing[]; error?: string }
      if (!response.ok || !payload.listings) throw new Error(payload.error || 'API недоступний')
      setListings(payload.listings)
      setApiMessage('DIM.RIA API підключений')
      setUpdated('щойно')
    } catch (error) {
      setApiMessage(error instanceof Error ? `${error.message}. Показано demo-дані.` : 'Показано demo-дані.')
      setListings(demoListings)
    } finally { setLoading(false) }
  }
  return <main>
    <nav className="nav shell"><div className="brand"><span className="brand-mark"><Sparkles size={17} /></span><span>Deal Finder</span></div><div className="nav-links"><a className="active" href="#search">Мій пошук</a><a href="#how">Як це працює</a><button className="icon-button" aria-label="Сповіщення"><Bell size={19} /></button><div className="avatar">А</div></div></nav>
    <section className="hero shell" id="search"><div><p className="eyebrow">ІНВЕСТИЦІЙНИЙ ПОШУК · {apiMessage.includes('DIM.RIA') ? 'LIVE API' : 'DEMO MODE'}</p><h1>Знайдіть житло,<br /><em>яке має сенс.</em></h1><p className="hero-copy">Ми щодня аналізуємо ринок і знаходимо об’єкти з найкращим співвідношенням ціни, району та потенціалу.</p></div><div className="status-card"><div className="status-dot" />{apiMessage}<div className="status-meta">Ключ DIM.RIA зберігається тільки на серверній функції</div></div></section>
    <section className="search-panel shell"><div className="panel-heading"><div><span className="step">01</span><h2>Ваш запит</h2></div><span className="live"><span />Оновлення двічі на день</span></div><div className="filters"><label>Місто<input value={profile.city} onChange={(e) => update('city', e.target.value)} /></label><label>Кімнати<select value={profile.rooms} onChange={(e) => update('rooms', Number(e.target.value))}><option value={1}>1 кімната</option><option value={2}>2 кімнати</option><option value={3}>3 кімнати</option></select></label><label>Площа, м²<div className="range-input"><input type="number" value={profile.minArea} onChange={(e) => update('minArea', Number(e.target.value))} /><span>—</span><input type="number" value={profile.maxArea} onChange={(e) => update('maxArea', Number(e.target.value))} /></div></label><label>Тип житла<select value={profile.propertyType} onChange={(e) => update('propertyType', e.target.value as 'all' | PropertyType)}><option value="all">Всі типи</option><option value="secondary">Вторинне</option><option value="new-build">Новобудова</option></select></label><label>Бюджет, грн<input type="number" value={profile.budget} onChange={(e) => update('budget', Number(e.target.value))} /></label></div><div className="panel-footer"><span><Filter size={16} /> {apiMessage.includes('DIM.RIA') ? 'Пошук через DIM.RIA API' : 'Демо-дані до підключення API'}</span><button className="primary-button" onClick={runSearch} disabled={loading}>{loading ? 'Завантаження…' : 'Оновити пошук'} <RefreshCw size={16} /></button></div></section>
    <section className="results shell"><div className="results-heading"><div><p className="eyebrow">02 · РЕЗУЛЬТАТ АНАЛІЗУ</p><h2>Найкраща пропозиція <span>для вас</span></h2></div><div className="last-update"><span className="status-dot" />Остання перевірка: {updated}</div></div>{best ? <><article className="featured-card"><div className="featured-image" style={{ backgroundImage: `url(${best.image})` }}><span className="recommendation"><Sparkles size={14} /> Найкращий збіг</span><button className="heart" onClick={() => setSaved((ids) => ids.includes(best.id) ? ids.filter((id) => id !== best.id) : [...ids, best.id])} aria-label="Зберегти"><Heart size={19} fill={saved.includes(best.id) ? 'currentColor' : 'none'} /></button></div><div className="featured-content"><div className="card-top"><div><span className="tag">{best.propertyType === 'new-build' ? 'НОВОБУДОВА' : 'ВТОРИННЕ ЖИТЛО'}</span><h3>{best.title}</h3><p className="location"><MapPin size={15} /> {best.district} район, Харків</p></div><div className="score"><strong>{best.score}</strong><span>/100<br />вигідність</span></div></div><div className="metrics"><div><span>Ціна</span><strong>{money.format(best.price)}</strong></div><div><span>Ціна за м²</span><strong>{number.format(best.pricePerMeter)} грн</strong></div><div><span>Площа</span><strong>{best.area} м²</strong></div><div><span>Рейтинг району</span><strong>{number.format(best.benchmark)} грн/м²</strong></div></div><div className="why"><Info size={17} /><p><strong>Чому цей об’єкт?</strong> Ціна на {Math.abs(best.discount)}% нижча за медіану аналогічних об’єктів у районі. Оголошення свіже та має статус перевіреного.</p></div><a className="listing-link" href={best.url} target="_blank" rel="noreferrer">Переглянути оголошення на DIM.RIA <ExternalLink size={16} /></a></div></article><div className="alternatives-heading"><h2>Ще {Math.max(0, results.length - 1)} варіанти</h2><button className="sort-button">За вигідністю <ChevronDown size={15} /></button></div><div className="alternative-grid">{results.slice(1).map((listing) => <article className="alternative-card" key={listing.id}><div className="alternative-image" style={{ backgroundImage: `url(${listing.image})` }}><span className="small-score">{listing.score}</span></div><div className="alternative-content"><span className="tag">{listing.propertyType === 'new-build' ? 'НОВОБУДОВА' : 'ВТОРИННЕ ЖИТЛО'}</span><h3>{listing.title}</h3><p className="location"><MapPin size={14} /> {listing.district} район</p><div className="alternative-price"><strong>{money.format(listing.price)}</strong><span>{number.format(listing.pricePerMeter)} грн/м²</span></div></div></article>)}</div></> : <div className="empty"><h3>Нічого не знайдено</h3><p>Спробуйте розширити діапазон площі або бюджету.</p></div>}</section>
    <section className="how shell" id="how"><div><p className="eyebrow">03 · ПРИНЦИП РОБОТИ</p><h2>Не просто найдешевше.<br /><span>А найрозумніша покупка.</span></h2></div><div className="how-copy"><p>Рейтинг враховує ціну за квадратний метр, середню ціну в районі, свіжість оголошення та надійність даних. Коли буде доступний API, система замінить демо-дані актуальними пропозиціями DIM.RIA.</p><div className="formula"><span>Ціна об’єкта за м²</span><strong>×</strong><span>Коефіцієнт району</span><strong>=</strong><span>Скоригована ціна</span></div></div></section><footer className="footer shell"><span>Deal Finder · перша версія</span><span>Дані демонстраційні · не є фінансовою рекомендацією</span></footer>
  </main>
}
export default App
