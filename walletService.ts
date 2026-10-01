import { TopUpRequest } from '../types';
import { OFFICIAL_CARD_NUMBER } from '../data/products';
import { safeSetItem } from '../utils/safeStorage';

const USER_BALANCE_KEY = 'solo_stars_user_wallet_balance';
const TOPUP_REQUESTS_KEY = 'solo_stars_topup_requests';

export function getUserWalletBalance(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(USER_BALANCE_KEY);
    if (!raw) return 0;
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

export function setUserWalletBalance(amount: number): number {
  const safe = Math.max(0, amount);
  safeSetItem(USER_BALANCE_KEY, String(safe));
  return safe;
}

export function creditUserWalletBalance(amount: number): number {
  const current = getUserWalletBalance();
  return setUserWalletBalance(current + amount);
}

export function deductUserWalletBalance(amount: number): boolean {
  const current = getUserWalletBalance();
  if (current < amount) return false;
  setUserWalletBalance(current - amount);
  return true;
}

export function getTopUpRequests(): TopUpRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TOPUP_REQUESTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function createTopUpRequest(
  username: string,
  amount: number,
  receiptImageUrl?: string
): TopUpRequest {
  const req: TopUpRequest = {
    id: `TOP-${Math.floor(100000 + Math.random() * 900000)}`,
    username: username.trim(),
    amount,
    receiptImageUrl,
    status: 'verifying', // Tekshirilmoqda
    createdAt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    card: OFFICIAL_CARD_NUMBER,
  };

  const existing = getTopUpRequests();
  // Keep maximum 10 recent items to conserve local storage space
  const updated = [req, ...existing.slice(0, 9)];
  safeSetItem(TOPUP_REQUESTS_KEY, JSON.stringify(updated));

  return req;
}

export function approveTopUpRequest(requestId: string): boolean {
  const requests = getTopUpRequests();
  const target = requests.find((r) => r.id === requestId);
  if (!target || target.status === 'approved') return false;

  target.status = 'approved';
  // Credit balance
  creditUserWalletBalance(target.amount);

  safeSetItem(TOPUP_REQUESTS_KEY, JSON.stringify(requests));
  return true;
}

export function rejectTopUpRequest(requestId: string): boolean {
  const requests = getTopUpRequests();
  const target = requests.find((r) => r.id === requestId);
  if (!target) return false;

  target.status = 'rejected';
  safeSetItem(TOPUP_REQUESTS_KEY, JSON.stringify(requests));
  return true;
}
