import { NewsTickerSettings } from '../types';

const NEWS_TICKER_KEY = 'solo_stars_news_ticker_settings';

const DEFAULT_NEWS_TICKER: NewsTickerSettings = {
  isEnabled: true,
  items: [
    "🔥 1 oylik Telegram Premium faqat 48.100 so'm admin bilan (@stars_oberin)!",
    "⚡ Telegram Stars va PUBG Mobile UC rasmiy CoinDrop API orqali lahzalik avtomat yetkaziladi!",
    "💳 To'lov uchun rasmiy karta: 9860 1201 4332 6722 (SOLO STARS RASMIY)",
    "🎁 Balans to'ldirish bo'limi orqali hisobingizni to'ldiring va bir zumda xarid qiling!",
    "★ 24/7 Rasmiy qo'llab-quvvatlash: @stars_oberin",
  ],
};

export function getNewsTickerSettings(): NewsTickerSettings {
  if (typeof window === 'undefined') return DEFAULT_NEWS_TICKER;
  try {
    const raw = localStorage.getItem(NEWS_TICKER_KEY);
    if (!raw) return DEFAULT_NEWS_TICKER;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NEWS_TICKER;
  }
}

export function saveNewsTickerSettings(settings: NewsTickerSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEWS_TICKER_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn(err);
  }
}
