export type CategoryType = 'stars' | 'premium' | 'pubg';

export interface ProductItem {
  id: string;
  category: CategoryType;
  title: string;
  quantity?: number;
  unit: string;
  price: number;
  formattedPrice: string;
  tag?: string;
  tagType?: 'fire' | 'admin' | 'popular' | 'vip';
  isPopular?: boolean;
  requiresAdmin?: boolean;
  description?: string;
  bonus?: string;
}

export type PaymentMethod = 'card' | 'balance' | 'click' | 'payme' | 'uzum' | 'ton';

export type OrderStatus =
  | 'verifying' // Tekshirilmoqda (shimmer loading & verification)
  | 'processing' // Bajarilmoqda
  | 'completed' // Bajarildi (API delivered)
  | 'admin_action_required' // Admin javobini kuting (balans yetmadi yoki admin tasdiqlashi)
  | 'api_stuck' // API qotib qoldi (qayta tekshirish kerak)
  | 'rejected'; // Bekor qilingan

export interface OrderDetails {
  id: string;
  item: ProductItem;
  recipientUsername: string; // e.g., @username or PUBG ID
  playerNickname?: string;
  paymentMethod: PaymentMethod;
  phoneNumber?: string;
  status: OrderStatus;
  createdAt: string;
  totalSum: number;
  receiptImageUrl?: string; // Uploaded payment receipt image
  apiDispatchStatus?: 'dispatched' | 'insufficient_funds' | 'stuck' | 'manual_review';
  apiResponseMsg?: string;
  reviewedByAdmin?: boolean;
  retryCount?: number;
  coindropOrderId?: number | string;
}

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  badgeText?: string;
  buttonText?: string;
  buttonUrl?: string;
  isActive: boolean;
  skipDurationSeconds: number;
}

export interface TopUpRequest {
  id: string;
  username: string;
  amount: number;
  receiptImageUrl?: string;
  status: 'verifying' | 'approved' | 'rejected';
  createdAt: string;
  card: string;
}

export interface NewsTickerSettings {
  isEnabled: boolean;
  items: string[];
}
