import { ProductItem } from '../types';
import { ADMIN_TELEGRAM_USERNAME, BOT_TELEGRAM_USERNAME } from '../data/products';

/**
 * Creates Telegram deep-link for a product so when user clicks "50 stars olish",
 * it automatically opens the Telegram bot/admin with that specific section pre-selected!
 */
export function getTelegramProductDeepLink(
  product: ProductItem,
  recipientId?: string,
  paymentMethod?: string
): string {
  const cleanCategory =
    product.category === 'stars'
      ? 'Telegram Stars'
      : product.category === 'premium'
      ? 'Telegram Premium'
      : 'PUBG Mobile UC';

  const textPayload = [
    `⭐ SOLO STARS BUYURTMASI:`,
    `━━━━━━━━━━━━━━━━━━`,
    `📦 Mahsulot: ${product.title} (${cleanCategory})`,
    `💰 Narxi: ${product.formattedPrice}`,
    `🆔 Paket kodi: #${product.id}`,
    recipientId ? `👤 Qabul qiluvchi: ${recipientId}` : '',
    paymentMethod ? `💳 To'lov: ${paymentMethod}` : '',
    `━━━━━━━━━━━━━━━━━━`,
    `Iltimos, ushbu buyurtmani avtomatik qabul qilib hisobimga tashlab bering!`,
  ]
    .filter(Boolean)
    .join('\n');

  // 1 oylik Premium kabi "faqat admin" mahsulotlar — oldingidek adminga matn bilan
  if (product.requiresAdmin) {
    return `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(textPayload)}`;
  }

  // Qolganlari — BOTga to'g'ridan-to'g'ri: bot bo'limni avtomat tanlaydi
  // Masalan: https://t.me/solostars_bot?start=buy_st_50
  const code = getBotStartCode(product);
  return code
    ? `https://t.me/${BOT_TELEGRAM_USERNAME}?start=${code}`
    : `https://t.me/${BOT_TELEGRAM_USERNAME}`;
}

/** Bot /start payload: buy_st_50, buy_pr_3, buy_uc_60 */
export function getBotStartCode(product: ProductItem): string | null {
  if (!product.quantity) return null;
  const kind = product.category === 'stars' ? 'st' : product.category === 'premium' ? 'pr' : 'uc';
  return `buy_${kind}_${product.quantity}`;
}

export function openTelegramForProduct(
  product: ProductItem,
  recipientId?: string,
  paymentMethod?: string
): void {
  const link = getTelegramProductDeepLink(product, recipientId, paymentMethod);
  if (typeof window !== 'undefined') {
    // Open in Telegram app
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
