import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  where
} from 'firebase/firestore';
import { OrderDetails, Advertisement } from '../types';
import { safeSetItem } from '../utils/safeStorage';

// Configuration from user's Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyDYSqfOZYmSFz3sPFpoggnUjx5lW_F1krY",
  authDomain: "ucshops.firebaseapp.com",
  databaseURL: "https://ucshops-default-rtdb.firebaseio.com",
  projectId: "ucshops",
  storageBucket: "ucshops.firebasestorage.app",
  messagingSenderId: "398331506122",
  appId: "1:398331506122:web:4e74adbd0951790fddb333",
  measurementId: "G-DJJGL1PEZR"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

const LOCAL_ORDERS_KEY = 'solo_stars_user_orders';
const LOCAL_AD_KEY = 'solo_stars_active_ad';

const DEFAULT_ADVERTISEMENT: Advertisement = {
  id: 'ad-welcome-1',
  title: "🔥 SOLO STARS: Telegram Stars & UC Super Chegirma!",
  description: "Eng arzon narxlarda 1 oylik Telegram Premium (48.100 so'm), Telegram Stars va PUBG Mobile UC rasmiy to'lov orqali tezkor yetkazib beriladi!",
  imageUrl: '/src/assets/images/solo_stars_hero_1790791988846.jpg',
  badgeText: 'Aksiya',
  buttonText: "Xarid Qilish",
  buttonUrl: '#shop',
  isActive: true,
  skipDurationSeconds: 3,
};

/**
 * Save order to Firebase Firestore and local backup
 */
export async function saveOrderToFirebase(order: OrderDetails): Promise<void> {
  // 1. Always save to LocalStorage safely (keeping max 10 recent orders)
  try {
    const existing = getLocalOrders();
    const updated = [order, ...existing.filter((o) => o.id !== order.id)].slice(0, 10);
    safeSetItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Local storage save error:', err);
  }

  // 2. Persist to Firestore
  try {
    const ordersCol = collection(db, 'orders');
    await addDoc(ordersCol, {
      orderId: order.id,
      item: order.item,
      recipientUsername: order.recipientUsername,
      paymentMethod: order.paymentMethod,
      phoneNumber: order.phoneNumber || null,
      status: order.status,
      createdAtStr: order.createdAt,
      totalSum: order.totalSum,
      receiptImageUrl: order.receiptImageUrl || null,
      apiDispatchStatus: order.apiDispatchStatus || null,
      apiResponseMsg: order.apiResponseMsg || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firebase order save warning (fallback to local):', err);
  }
}

/**
 * Read local cached orders
 */
export function getLocalOrders(): OrderDetails[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Update order status (Admin approval / rejection / API dispatch)
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderDetails['status'],
  extraUpdates?: Partial<OrderDetails>
): Promise<void> {
  // Update local
  try {
    const existing = getLocalOrders();
    const updated = existing.map((o) => {
      if (o.id === orderId) {
        return { ...o, status: newStatus, ...extraUpdates };
      }
      return o;
    });
    safeSetItem(LOCAL_ORDERS_KEY, JSON.stringify(updated.slice(0, 10)));
  } catch (err) {
    console.warn(err);
  }

  // Try updating Firestore
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('orderId', '==', orderId), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, {
        status: newStatus,
        reviewedByAdmin: true,
        ...extraUpdates,
      });
    }
  } catch (err) {
    console.warn('Firestore update warning:', err);
  }
}

/**
 * Fetch orders from Firebase Firestore and merge with local orders
 */
export async function fetchUserOrders(usernameFilter?: string): Promise<OrderDetails[]> {
  const localOrders = getLocalOrders();

  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('timestamp', 'desc'), limit(100));
    const snapshot = await getDocs(q);

    const remoteOrders: OrderDetails[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      remoteOrders.push({
        id: data.orderId || docSnap.id,
        item: data.item,
        recipientUsername: data.recipientUsername,
        paymentMethod: data.paymentMethod || 'click',
        phoneNumber: data.phoneNumber || undefined,
        status: data.status || 'processing',
        createdAt: data.createdAtStr || 'Yaqinda',
        totalSum: data.totalSum || data.item?.price || 0,
        receiptImageUrl: data.receiptImageUrl || undefined,
        apiDispatchStatus: data.apiDispatchStatus || undefined,
        apiResponseMsg: data.apiResponseMsg || undefined,
        reviewedByAdmin: data.reviewedByAdmin || false,
      });
    });

    // Merge remote and local (avoiding duplicates by id)
    const map = new Map<string, OrderDetails>();
    localOrders.forEach((o) => map.set(o.id, o));
    remoteOrders.forEach((o) => map.set(o.id, o));

    const combined = Array.from(map.values());

    if (usernameFilter && usernameFilter.trim()) {
      const cleanFilter = usernameFilter.trim().toLowerCase().replace(/^@/, '');
      return combined.filter((o) =>
        o.recipientUsername.toLowerCase().includes(cleanFilter) ||
        o.id.toLowerCase().includes(cleanFilter)
      );
    }

    return combined;
  } catch (err) {
    console.warn('Could not fetch from remote Firestore, using local orders:', err);
    if (usernameFilter && usernameFilter.trim()) {
      const cleanFilter = usernameFilter.trim().toLowerCase().replace(/^@/, '');
      return localOrders.filter((o) =>
        o.recipientUsername.toLowerCase().includes(cleanFilter) ||
        o.id.toLowerCase().includes(cleanFilter)
      );
    }
    return localOrders;
  }
}

/**
 * Advertisement storage
 */
export function getStoredAdvertisement(): Advertisement {
  if (typeof window === 'undefined') return DEFAULT_ADVERTISEMENT;
  try {
    const raw = localStorage.getItem(LOCAL_AD_KEY);
    if (!raw) return DEFAULT_ADVERTISEMENT;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ADVERTISEMENT;
  }
}

export function saveStoredAdvertisement(ad: Advertisement): void {
  safeSetItem(LOCAL_AD_KEY, JSON.stringify(ad));
}
