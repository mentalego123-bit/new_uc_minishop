import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Send,
  ArrowLeft,
  Flame,
  Cloud,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Wallet,
  PlusCircle,
  CheckCheck
} from 'lucide-react';
import { OrderDetails } from '../types';
import { fetchUserOrders, updateOrderStatus } from '../services/firebase';
import { recheckOrRetryOrder } from '../services/starsApi';
import { getUserWalletBalance } from '../services/walletService';
import { ADMIN_TELEGRAM_USERNAME } from '../data/products';
import { sfx } from '../utils/sfx';
import { SpendingChart } from './SpendingChart';

interface MyOrdersViewProps {
  onBackToShop: () => void;
  onOpenReceipt: (order: OrderDetails) => void;
  onOpenAdminModal: () => void;
  onOpenTopUpModal?: () => void;
}

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 26,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -15,
    transition: { duration: 0.2 },
  },
};

export const MyOrdersView: React.FC<MyOrdersViewProps> = ({
  onBackToShop,
  onOpenReceipt,
  onOpenAdminModal,
  onOpenTopUpModal,
}) => {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verifying' | 'processing' | 'admin' | 'stuck' | 'completed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [recentNotification, setRecentNotification] = useState<string | null>(null);
  const userBalance = getUserWalletBalance();

  const loadOrders = async (queryText?: string) => {
    setLoading(true);
    try {
      const data = await fetchUserOrders(queryText);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleRefresh = () => {
    sfx.playSelect();
    loadOrders(searchQuery);
    setRecentNotification("Buyurtmalar ro'yxati yangilandi!");
    setTimeout(() => setRecentNotification(null), 3000);
  };

  const handleRetryApi = async (order: OrderDetails) => {
    setRetryingId(order.id);
    sfx.playFireWhoosh();

    try {
      const res = await recheckOrRetryOrder(order);
      if (res.status === 'dispatched') {
        await updateOrderStatus(order.id, 'completed', {
          apiDispatchStatus: 'dispatched',
          apiResponseMsg: res.message,
          retryCount: (order.retryCount || 0) + 1,
        });
        sfx.playUdarStrike();
        setRecentNotification(`✓ ${order.item.title} buyurtmasi muvaffaqiyatli bajarildi!`);
      } else {
        await updateOrderStatus(order.id, 'admin_action_required', {
          apiDispatchStatus: 'insufficient_funds',
          apiResponseMsg: res.message,
          retryCount: (order.retryCount || 0) + 1,
        });
        sfx.playAdminAlert();
      }
      await loadOrders();
    } catch (e) {
      console.error(e);
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopyReceipt = (order: OrderDetails) => {
    const text = `★ SOLO STARS XARID CHEKI ★\nOrder ID: ${order.id}\nMahsulot: ${order.item.title}\nNarxi: ${order.item.formattedPrice}\nQabul qiluvchi: ${order.recipientUsername}\nHolati: ${order.status}\nVaqti: ${order.createdAt}`;
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    sfx.playSuccess();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'verifying' && o.status !== 'verifying') return false;
    if (statusFilter === 'processing' && o.status !== 'processing') return false;
    if (statusFilter === 'admin' && o.status !== 'admin_action_required') return false;
    if (statusFilter === 'stuck' && o.status !== 'api_stuck') return false;
    if (statusFilter === 'completed' && o.status !== 'completed') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace(/^@/, '');
    return (
      o.recipientUsername.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.item.title.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Dynamic Status Toast Bar */}
      <AnimatePresence>
        {recentNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg flex items-center justify-between gap-3 text-xs font-bold"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>{recentNotification}</span>
            </div>
            <button
              onClick={() => setRecentNotification(null)}
              className="text-white/80 hover:text-white cursor-pointer px-2 py-0.5"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner with Balance and Navigation */}
      <motion.div
        layout
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.playSelect();
              onBackToShop();
            }}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Do'konga qaytish</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2">
              <span>Mening Buyurtmalarim</span>
              <motion.span
                key={filteredOrders.length}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 font-mono font-bold"
              >
                {filteredOrders.length} ta
              </motion.span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Real-time sinxronizatsiya & Bot integratsiyasi</span>
            </div>
          </div>
        </div>

        {/* User Balance Box + Topup Button */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <motion.div
            layout
            className="px-3.5 py-2 rounded-2xl bg-sky-50 border border-sky-200 flex items-center gap-2"
          >
            <Wallet className="w-4 h-4 text-sky-600" />
            <div className="text-left text-xs">
              <span className="text-[10px] text-slate-500 block">Balansingiz:</span>
              <motion.span
                key={userBalance}
                initial={{ scale: 1.15, color: '#0284c7' }}
                animate={{ scale: 1, color: '#0098ea' }}
                transition={{ duration: 0.4 }}
                className="font-bold text-[#0098ea] font-display text-sm inline-block"
              >
                {userBalance.toLocaleString('uz-UZ')} so'm
              </motion.span>
            </div>
          </motion.div>

          {onOpenTopUpModal && (
            <button
              onClick={() => {
                sfx.playSelect();
                onOpenTopUpModal();
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>To'ldirish</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* 30-Day Spending History Visualization using Recharts */}
      <SpendingChart orders={orders} />

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          {[
            { id: 'all' as const, label: 'Barchasi' },
            { id: 'verifying' as const, label: 'Tekshirilmoqda' },
            { id: 'stuck' as const, label: 'API Qotgan' },
            { id: 'admin' as const, label: 'Admin Bilan' },
            { id: 'completed' as const, label: 'Bajarilgan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                sfx.playSelect();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-[#0098ea] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Username yoki Order ID bo'yicha..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Orders List with Framer Motion AnimatePresence & layout */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Buyurtmalar yuklanmoqda...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <motion.div
          variants={listContainerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order, index) => {
              const isVerifying = order.status === 'verifying';
              const isStuck = order.status === 'api_stuck';
              const is1MonthAdmin = order.status === 'admin_action_required' || order.item.requiresAdmin;
              const isDone = order.status === 'completed';
              const isRetrying = retryingId === order.id;
              const isBrandNew = index === 0;

              return (
                <motion.div
                  key={order.id}
                  layout
                  variants={cardItemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className={`relative rounded-3xl p-5 sm:p-6 transition-all shadow-sm overflow-hidden flex flex-col justify-between group ${
                    isVerifying
                      ? 'bg-amber-50/40 border-2 border-amber-400/80 shadow-md'
                      : isStuck
                      ? 'bg-red-50/40 border-2 border-red-400/80'
                      : 'bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-md'
                  }`}
                >
                  {/* Shimmer animation bar if verifying */}
                  {isVerifying && (
                    <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-30" />
                  )}

                  <div className="relative z-10">
                    {/* Top line: ID, status, and new badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          ID: <span className="text-[#0098ea]">{order.id}</span>
                        </span>
                        {isBrandNew && (
                          <motion.span
                            initial={{ scale: 0.8 }}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 2.2 }}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500 text-white shadow-xs"
                          >
                            Yangi
                          </motion.span>
                        )}
                      </div>

                      {/* Status Badge */}
                      {isVerifying ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                          <span>Tekshirilmoqda</span>
                        </span>
                      ) : isStuck ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>API Qotib Qoldi</span>
                        </span>
                      ) : is1MonthAdmin ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Flame className="w-3 h-3 text-amber-600" />
                          <span>Admin javobini kuting</span>
                        </span>
                      ) : isDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Bajarildi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                          <Clock className="w-3 h-3 text-sky-600 animate-spin" />
                          <span>Bajarilmoqda</span>
                        </span>
                      )}
                    </div>

                    {/* Product title and price */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-[#0098ea] transition-colors font-display">
                          {order.item.title}
                        </h3>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Qabul qiluvchi: <span className="text-[#0098ea] font-mono font-bold">{order.recipientUsername}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-[#0098ea] font-display">
                          {order.item.formattedPrice}
                        </div>
                        <div className="text-[10px] uppercase font-mono text-slate-400">
                          {order.paymentMethod === 'balance' ? 'Balansdan' : 'Karta (9860)'}
                        </div>
                      </div>
                    </div>

                    {/* API response message if any */}
                    {order.apiResponseMsg && (
                      <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono">
                        <span>ℹ {order.apiResponseMsg}</span>
                      </div>
                    )}

                    {/* Timestamp & info */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Vaqti: {order.createdAt}</span>
                      {order.receiptImageUrl && (
                        <span className="text-sky-600 font-semibold">✓ Chek yuklangan</span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Retry button if stuck */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 relative z-10">
                    {(isStuck || isVerifying) && (
                      <button
                        onClick={() => handleRetryApi(order)}
                        disabled={isRetrying}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>{isRetrying ? 'Tekshirilmoqda...' : 'Qayta Tekshirish (Retry API)'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenReceipt(order)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-center"
                    >
                      Chek
                    </button>

                    <button
                      onClick={() => handleCopyReceipt(order)}
                      title="Chekni nusxalash"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    >
                      {copiedId === order.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <a
                      href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(
                        `Salom admin, buyurtmam statusini tekshirmoqchiman:\nID: ${order.id}\nMahsulot: ${order.item.title}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => sfx.playFireWhoosh()}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Adminga</span>
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 px-4 rounded-3xl bg-white border border-slate-200 shadow-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Buyurtmalar topilmadi</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Ushbu filtr bo'yicha hech qanday buyurtma mavjud emas.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={onBackToShop}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 transition-all shadow-md cursor-pointer"
            >
              Do'konga O'tish
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
