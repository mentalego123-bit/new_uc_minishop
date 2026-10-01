/**
 * Safe LocalStorage wrapper to prevent QuotaExceededError crashes
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    console.warn(`LocalStorage Quota exceeded on key "${key}", attempting cleanup...`, err);

    try {
      // 1. If it's a JSON array, trim it down to latest 8 items and strip large image URLs from older entries
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const trimmed = parsed.slice(0, 8).map((item, index) => {
          if (index > 2 && item && typeof item === 'object' && 'receiptImageUrl' in item) {
            // Keep receipt only on the 3 newest items
            return { ...item, receiptImageUrl: undefined };
          }
          return item;
        });

        localStorage.setItem(key, JSON.stringify(trimmed));
        return true;
      }
    } catch {
      // Ignore
    }

    // 2. Fallback: try clearing known bulky caches
    try {
      localStorage.removeItem('solo_stars_topup_requests');
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.error(`Cannot save key "${key}" even after cleanup.`);
      return false;
    }
  }
}
