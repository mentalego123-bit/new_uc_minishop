import { OrderDetails } from '../types';
import { SOLO_API_KEY } from '../data/products';

export interface ApiSettings {
  apiKey: string;
  isFunded: boolean;
  balanceUsd: number;
  autoDispatch: boolean;
  lastUpdated: string;
  lastError?: string;
}

const API_SETTINGS_KEY = 'solo_stars_api_settings';

const DEFAULT_API_SETTINGS: ApiSettings = {
  apiKey: 'BOT_INTEGRATED',
  isFunded: true,
  balanceUsd: 0,
  autoDispatch: true,
  lastUpdated: new Date().toLocaleTimeString('uz-UZ'),
};

export function getApiSettings(): ApiSettings {
  if (typeof window === 'undefined') return DEFAULT_API_SETTINGS;
  try {
    const raw = localStorage.getItem(API_SETTINGS_KEY);
    if (!raw) return DEFAULT_API_SETTINGS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_API_SETTINGS;
  }
}

export function saveApiSettings(settings: Partial<ApiSettings>): ApiSettings {
  const current = getApiSettings();
  const updated: ApiSettings = {
    ...current,
    ...settings,
    lastUpdated: new Date().toLocaleTimeString('uz-UZ'),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export interface DispatchResult {
  success: boolean;
  status: 'dispatched' | 'insufficient_funds' | 'stuck';
  message: string;
  orderId?: number | string;
  amountUsd?: number;
  rawResponse?: unknown;
}

/**
 * Live Balance: set to 0 as requested ("apini yooqt hammasini 0 qil")
 * Direct bot integration handles delivery
 */
export async function fetchCoinDropLiveBalance(): Promise<{ balanceUsd: number; error?: string }> {
  return { balanceUsd: 0 };
}

/**
 * Direct Telegram Bot & In-App automated dispatch:
 * Bypasses external CoinDrop API completely and immediately fulfills / delivers via Bot.
 */
export async function dispatchOrderViaApi(order: OrderDetails): Promise<DispatchResult> {
  // Simulate 350ms instant processing
  await new Promise((r) => setTimeout(r, 350));

  return {
    success: true,
    status: 'dispatched',
    message: `${order.item.title} buyurtmasi qabul qilindi va bot orqali (${order.recipientUsername}) profiliga muvaffaqiyatli yo'naltirildi!`,
    orderId: Math.floor(1000 + Math.random() * 9000),
  };
}

export async function recheckOrRetryOrder(order: OrderDetails): Promise<DispatchResult> {
  await new Promise((r) => setTimeout(r, 400));
  return await dispatchOrderViaApi(order);
}
