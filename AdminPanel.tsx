import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Package,
  Megaphone,
  CreditCard,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  RefreshCw,
  X,
  Flame,
  ArrowRight,
  DollarSign,
  AlertTriangle,
  RotateCw,
  Wallet,
  Plus,
  Trash2,
  Bell,
  Zap,
  Check
} from 'lucide-react';
import { OrderDetails, Advertisement, TopUpRequest, NewsTickerSettings } from '../types';
import {
  fetchUserOrders,
  updateOrderStatus,
  getStoredAdvertisement,
  saveStoredAdvertisement
} from '../services/firebase';
import {
  getApiSettings,
  saveApiSettings,
  dispatchOrderViaApi,
  fetchCoinDropLiveBalance,
  recheckOrRetryOrder
} from '../services/starsApi';
import {
  getTopUpRequests,
  approveTopUpRequest,
  rejectTopUpRequest
} from '../services/walletService';
import { getNewsTickerSettings, saveNewsTickerSettings } from '../services/newsService';
import { OFFICIAL_CARD_NUMBER, OFFICIAL_CARD_HOLDER, ADMIN_TELEGRAM_USERNAME, SOLO_API_KEY } from '../data/products';
import { sfx } from '../utils/sfx';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onOrderUpdated }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'topups' | 'ticker' | 'ads' | 'api' | 'card'>('orders');
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [topups, setTopups] = useState<TopUpRequest[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // API Settings State
  const [apiSettings, setApiSettings] = useState(getApiSettings());
  const [isCheckingApi, setIsCheckingApi] = useState(false);

  // Advertisement State
  const [adForm, setAdForm] = useState<Advertisement>(getStoredAdvertisement());
  const [adSaved, setAdSaved] = useState(false);

  // News Ticker State
  const [tickerSettings, setTickerSettings] = useState<NewsTickerSettings>(getNewsTickerSettings());
  const [newTickerItem, setNewTickerItem] = useState('');
  const [tickerSaved, setTickerSaved] = useState(false);

  const loadAllData = async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchUserOrders();
      setOrders(data);
      setTopups(getTopUpRequests());
      setApiSettings(getApiSettings());
      setTickerSettings(getNewsTickerSettings());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  /**
   * Automated workflow required by user:
   * "admin tasdiqlasa balansiga qoshiladi va keyin srzau balans tekshiraid bolsa tshlab beradi bu bot bilan integratsiya boladi"
   */
  const handleApproveOrder = async (order: OrderDetails) => {
    sfx.playFireWhoosh();

    // 1. Immediately check CoinDrop API live balance
    const liveBal = await fetchCoinDropLiveBalance();

    if (liveBal.balanceUsd > 0.5) {
      // API balance is available -> Dispatch immediately!
      const result = await dispatchOrderViaApi(order);
      if (result.status === 'dispatched') {
        await updateOrderStatus(order.id, 'completed', {
          apiDispatchStatus: 'dispatched',
          apiResponseMsg: "CoinDrop API orqali hisobiga muvaffaqiyatli tashlab berildi!",
        });
        sfx.playUdarStrike();
        showNotification("✓ To'lov tasdiqlandi va CoinDrop API orqali avtomat tashlab berildi!");
      } else {
        await updateOrderStatus(order.id, 'admin_action_required', {
          apiDispatchStatus: 'insufficient_funds',
          apiResponseMsg: result.message,
        });
        sfx.playAdminAlert();
        showNotification("⚠ API da uzilish yoki balans yetmadi — admin javobini kuting holatida.");
      }
    } else {
      // No API balance
      await updateOrderStatus(order.id, 'admin_action_required', {
        apiDispatchStatus: 'insufficient_funds',
        apiResponseMsg: "CoinDrop API balansida mablag' yo'q — admin javobini kuting!",
      });
      sfx.playAdminAlert();
      showNotification("⚠ API balansida mablag' yo'q — admin javobini kuting!");
    }

    await loadAllData();
    if (onOrderUpdated) onOrderUpdated();
  };

  const handleDispatchViaApi = async (order: OrderDetails) => {
    sfx.playFireWhoosh();
    const result = await dispatchOrderViaApi(order);
    if (result.status === 'dispatched') {
      await updateOrderStatus(order.id, 'completed', {
        apiDispatchStatus: 'dispatched',
        apiResponseMsg: result.message,
      });
      sfx.playUdarStrike();
      showNotification("✓ API orqali tashlab berildi!");
    } else if (result.status === 'stuck') {
      await updateOrderStatus(order.id, 'api_stuck', {
        apiDispatchStatus: 'stuck',
        apiResponseMsg: "API serverida qotish yuz berdi — qayta tekshiring!",
      });
      sfx.playAdminAlert();
      showNotification("⚠ API qotib qoldi! Qayta tekshiring.");
    } else {
      await updateOrderStatus(order.id, 'admin_action_required', {
        apiDispatchStatus: 'insufficient_funds',
        apiResponseMsg: result.message,
      });
      sfx.playAdminAlert();
      showNotification("⚠ API balansida mablag' yo'q!");
    }
    setApiSettings(getApiSettings());
    await loadAllData();
    if (onOrderUpdated) onOrderUpdated();
  };

  const handleRejectOrder = async (order: OrderDetails) => {
    sfx.playSelect();
    await updateOrderStatus(order.id, 'rejected', {
      apiResponseMsg: "To'lov cheki yaroqsiz yoki mablag' kelib tushmadi.",
    });
    await loadAllData();
    if (onOrderUpdated) onOrderUpdated();
  };

  const handleApproveTopUp = (id: string) => {
    sfx.playSuccess();
    approveTopUpRequest(id);
    setTopups(getTopUpRequests());
    showNotification("✓ Balans tasdiqlandi va foydalanuvchi hisobiga qo'shildi!");
    if (onOrderUpdated) onOrderUpdated();
  };

  const handleRejectTopUp = (id: string) => {
    sfx.playSelect();
    rejectTopUpRequest(id);
    setTopups(getTopUpRequests());
  };

  const handleCheckLiveBalance = async () => {
    setIsCheckingApi(true);
    sfx.playSelect();
    await fetchCoinDropLiveBalance();
    setIsCheckingApi(false);
    setApiSettings(getApiSettings());
    sfx.playSuccess();
  };

  const handleSaveApiBalanceState = (isFunded: boolean, balance: number) => {
    sfx.playSelect();
    const updated = saveApiSettings({ isFunded, balanceUsd: balance });
    setApiSettings(updated);
  };

  const handleSaveAd = (e: React.FormEvent) => {
    e.preventDefault();
    sfx.playSuccess();
    saveStoredAdvertisement(adForm);
    setAdSaved(true);
    setTimeout(() => setAdSaved(false), 2500);
  };

  const handleAddTickerItem = () => {
    if (!newTickerItem.trim()) return;
    const updated = {
      ...tickerSettings,
      items: [...tickerSettings.items, newTickerItem.trim()],
    };
    setTickerSettings(updated);
    saveNewsTickerSettings(updated);
    setNewTickerItem('');
    sfx.playSelect();
  };

  const handleRemoveTickerItem = (idx: number) => {
    const updated = {
      ...tickerSettings,
      items: tickerSettings.items.filter((_, i) => i !== idx),
    };
    setTickerSettings(updated);
    saveNewsTickerSettings(updated);
    sfx.playSelect();
  };

  const pendingTopUpsCount = topups.filter((t) => t.status === 'verifying').length;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0d1424] border-2 border-sky-500 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(2,132,199,0.3)] text-slate-900 dark:text-white max-h-[92vh] flex flex-col overflow-hidden">
        {/* Toast Alert */}
        {statusNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-xl animate-in slide-in-from-top duration-200">
            {statusNotification}
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shadow-lg shadow-sky-600/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black font-display text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>SOLO STARS Admin Paneli</span>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 font-mono">
                  @{ADMIN_TELEGRAM_USERNAME}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cheklarni tekshirish, balans tasdiqlash, CoinDrop API va yangiliklar satri
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 py-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
          {[
            { id: 'orders' as const, label: 'Buyurtmalar & Cheklar', icon: Package, count: orders.length },
            { id: 'topups' as const, label: 'Balans So\'rovlari', icon: Wallet, count: pendingTopUpsCount },
            { id: 'ticker' as const, label: 'Yangiliklar Satri (Ticker)', icon: Bell },
            { id: 'api' as const, label: 'CoinDrop API (v1)', icon: Key },
            { id: 'ads' as const, label: 'Reklama Qo\'shish', icon: Megaphone },
            { id: 'card' as const, label: 'To\'lov Kartasi', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  sfx.playSelect();
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-500 text-white font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* TAB 1: BUYURTMALAR */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Kelib tushgan buyurtmalar (chek yuklangan):
                </span>
                <button
                  onClick={loadAllData}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingOrders ? 'animate-spin text-sky-500' : ''}`} />
                  <span>Yangilash</span>
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Yuklanmoqda...
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Buyurtmalar mavjud emas.
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {order.receiptImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(order.receiptImageUrl!)}
                            className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 border-sky-500/60 shadow cursor-pointer"
                            title="Chekni kattalashtirib ko'rish"
                          >
                            <img
                              src={order.receiptImageUrl}
                              alt="Chek"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                              <Eye className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 shrink-0 text-[10px]">
                            <span>{order.paymentMethod === 'balance' ? 'Balans' : "Chek yo'q"}</span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                              {order.id}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {order.item.title}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({order.item.formattedPrice})
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                            Qabul qiluvchi: <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{order.recipientUsername}</span>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-2 items-center">
                            <span>To'lov: <b className="text-slate-800 dark:text-slate-200 uppercase">{order.paymentMethod}</b></span>
                            <span>·</span>
                            <span>Vaqt: {order.createdAt}</span>
                          </div>

                          {order.apiResponseMsg && (
                            <div className="mt-1.5 text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono inline-block">
                              ℹ {order.apiResponseMsg}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status and Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {order.status === 'completed' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Bajarildi</span>
                          </span>
                        ) : order.status === 'api_stuck' ? (
                          <button
                            onClick={() => handleDispatchViaApi(order)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer animate-pulse"
                            title="API qotib qolgan — qayta tekshirish"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Qayta Tekshir</span>
                          </button>
                        ) : (
                          <>
                            {/* Tasdiqlash & Srazu Balans Tekshirib Tashlash */}
                            <button
                              onClick={() => handleApproveOrder(order)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer"
                              title="To'lovni tasdiqlash va CoinDrop API orqali srazu tashlash"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Tasdiqlash & Tashlash</span>
                            </button>

                            <button
                              onClick={() => handleDispatchViaApi(order)}
                              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer"
                              title="CoinDrop API orqali tashlash"
                            >
                              <Key className="w-3 h-3" />
                              <span>API</span>
                            </button>

                            <button
                              onClick={() => handleRejectOrder(order)}
                              className="px-2.5 py-1.5 rounded-xl bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-xs font-semibold cursor-pointer"
                            >
                              Bekor
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BALANS TO'LDIRISH */}
          {activeTab === 'topups' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Balans To'ldirish So'rovlari</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Admin to'lovni tasdiqlashi bilan foydalanuvchi hisobiga so'm qo'shiladi!
                  </p>
                </div>
              </div>

              {topups.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Hozircha balans so'rovlari yo'q.
                </div>
              ) : (
                <div className="space-y-3">
                  {topups.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        {req.receiptImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(req.receiptImageUrl!)}
                            className="w-16 h-16 rounded-xl overflow-hidden border-2 border-sky-500/50 shrink-0 cursor-pointer"
                          >
                            <img src={req.receiptImageUrl} alt="Chek" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 text-xs shrink-0">
                            Chek yo'q
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{req.id}</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{req.username}</span>
                          </div>
                          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-display mt-0.5">
                            +{req.amount.toLocaleString('uz-UZ')} so'm
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Vaqti: {req.createdAt}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {req.status === 'approved' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                            ✓ Tasdiqlangan
                          </span>
                        ) : req.status === 'rejected' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30">
                            ✗ Rad etilgan
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApproveTopUp(req.id)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>To'lovni Tasdiqlash (+{req.amount.toLocaleString('uz-UZ')} so'm)</span>
                            </button>

                            <button
                              onClick={() => handleRejectTopUp(req.id)}
                              className="px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-200 text-xs font-semibold cursor-pointer"
                            >
                              Rad etish
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TICKER */}
          {activeTab === 'ticker' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Bosh Sahifadagi Yuguruvchi Satr (News Ticker)</span>
                  </h3>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Faol:</span>
                  <input
                    type="checkbox"
                    checked={tickerSettings.isEnabled}
                    onChange={(e) => {
                      const updated = { ...tickerSettings, isEnabled: e.target.checked };
                      setTickerSettings(updated);
                      saveNewsTickerSettings(updated);
                    }}
                    className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTickerItem}
                  onChange={(e) => setNewTickerItem(e.target.value)}
                  placeholder="Yangi e'lon yozing..."
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddTickerItem}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Qo'shish</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {tickerSettings.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTickerItem(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: API */}
          {activeTab === 'api' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>CoinDrop API (https://coindrop.uz/api/v1)</span>
                </h3>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-mono">X-API-Key:</span>
                <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 break-all select-all">
                  {SOLO_API_KEY}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    CoinDrop API Balansi:
                  </span>
                  <button
                    onClick={handleCheckLiveBalance}
                    disabled={isCheckingApi}
                    className="px-3 py-1 bg-sky-50 dark:bg-sky-600/30 text-sky-600 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingApi ? 'animate-spin' : ''}`} />
                    <span>Balansni Tekshirish</span>
                  </button>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    ${apiSettings.balanceUsd.toFixed(2)} USD
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    (~{(apiSettings.balanceUsd * 12900).toLocaleString('uz-UZ')} so'm)
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveApiBalanceState(true, 150.00)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Balans Bor ($150.00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveApiBalanceState(false, 0.00)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Balans 0 (Sinov: Admin Javobin Kutin)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REKLAMA */}
          {activeTab === 'ads' && (
            <form onSubmit={handleSaveAd} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Reklama Sozlamalari</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Faol:</span>
                  <input
                    type="checkbox"
                    checked={adForm.isActive}
                    onChange={(e) => setAdForm({ ...adForm, isActive: e.target.checked })}
                    className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sarlavha:</label>
                <input
                  type="text"
                  value={adForm.title}
                  onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tavsif:</label>
                <textarea
                  rows={2}
                  value={adForm.description}
                  onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-sky-600 hover:bg-sky-500 transition-all cursor-pointer"
              >
                Saqlash
              </button>
            </form>
          )}

          {/* TAB 6: KARTA */}
          {activeTab === 'card' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">To'lov Kartasi</h3>
              <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 text-white">
                <div className="text-xs uppercase font-bold text-sky-200">{OFFICIAL_CARD_HOLDER}</div>
                <div className="font-mono text-2xl font-black tracking-widest my-2">{OFFICIAL_CARD_NUMBER}</div>
                <div className="text-xs text-sky-100">Humo / Uzcard</div>
              </div>
            </div>
          )}
        </div>

        {/* Lightbox for zooming receipt */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 p-2 text-white bg-slate-800 rounded-full cursor-pointer hover:bg-slate-700"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedReceipt}
              alt="Chek kattalashtirilgan"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        )}
      </div>
    </div>
  );
};
