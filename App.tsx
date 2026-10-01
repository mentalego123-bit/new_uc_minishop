/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Star,
  ShieldCheck,
  Send,
  Sparkles,
  Zap,
  Check,
  ArrowRight,
  Gamepad2,
  Gem,
  Search,
  ShoppingCart,
  Copy,
  Info,
  Package,
  CreditCard,
  Shield,
  Wallet,
  PlusCircle
} from 'lucide-react';
import { FireCanvas } from './components/FireCanvas';
import { Header } from './components/Header';
import { NewsTicker } from './components/NewsTicker';
import { ProductCard } from './components/ProductCard';
import { AdminFastTrackModal } from './components/AdminFastTrackModal';
import { OrderCheckoutModal } from './components/OrderCheckoutModal';
import { OrderReceiptModal } from './components/OrderReceiptModal';
import { TopUpBalanceModal } from './components/TopUpBalanceModal';
import { CustomCalculator } from './components/CustomCalculator';
import { FAQSection } from './components/FAQSection';
import { FloatingTelegramChat } from './components/FloatingTelegramChat';
import { MyOrdersView } from './components/MyOrdersView';
import { AdminPanel } from './components/AdminPanel';
import { AdPopupModal } from './components/AdPopupModal';
import { SecretAdminModal } from './components/SecretAdminModal';
import {
  TELEGRAM_PREMIUM_PRODUCTS,
  TELEGRAM_STARS_PRODUCTS,
  PUBG_UC_PRODUCTS,
  ADMIN_TELEGRAM_USERNAME,
  CHANNEL_TELEGRAM_LINK,
  OFFICIAL_CARD_NUMBER,
  OFFICIAL_CARD_HOLDER,
  LOGO_IMAGE_PATH,
} from './data/products';
import { ProductItem, OrderDetails, CategoryType, Advertisement, NewsTickerSettings } from './types';
import { sfx } from './utils/sfx';
import { getLocalOrders, saveOrderToFirebase, getStoredAdvertisement } from './services/firebase';
import { getUserWalletBalance } from './services/walletService';
import { getNewsTickerSettings } from './services/newsService';
import { openTelegramForProduct } from './utils/telegramLink';

export default function App() {
  const [currentView, setCurrentView] = useState<'shop' | 'orders'>('shop');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('stars');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    TELEGRAM_STARS_PRODUCTS[3] // default selected 250 Stars
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isFireMode, setIsFireMode] = useState(false);
  const [isMuted, setIsMuted] = useState(sfx.getIsMuted());
  const [ordersCount, setOrdersCount] = useState(0);
  const [userBalance, setUserBalance] = useState(getUserWalletBalance());
  const [copiedCard, setCopiedCard] = useState(false);

  // Modals
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSecretAdminModalOpen, setIsSecretAdminModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderDetails | null>(null);
  const [activeAd, setActiveAd] = useState<Advertisement | null>(null);
  const [tickerSettings, setTickerSettings] = useState<NewsTickerSettings>(getNewsTickerSettings());

  const refreshBalanceAndOrders = () => {
    setUserBalance(getUserWalletBalance());
    const existing = getLocalOrders();
    setOrdersCount(existing.length);
    setTickerSettings(getNewsTickerSettings());
  };

  // Initialize data on mount
  useEffect(() => {
    refreshBalanceAndOrders();

    // Check advertisement popup on site entry ("kirgandna reklamma skip qiladi")
    const ad = getStoredAdvertisement();
    if (ad && ad.isActive) {
      setActiveAd(ad);
    }
  }, []);

  const handleCopyCard = () => {
    navigator.clipboard.writeText(OFFICIAL_CARD_NUMBER.replace(/\s+/g, ''));
    setCopiedCard(true);
    sfx.playSuccess();
    setTimeout(() => setCopiedCard(false), 2000);
  };

  // Sound Toggle
  const handleToggleMute = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  // Fire Mode Toggle
  const handleToggleFireMode = () => {
    const next = !isFireMode;
    setIsFireMode(next);
    if (next) {
      sfx.playUdarStrike();
    } else {
      sfx.playSelect();
    }
  };

  // Category switch
  const handleCategoryChange = (category: CategoryType) => {
    setActiveCategory(category);
    sfx.playSelect();

    if (category === 'stars') {
      setSelectedProduct(TELEGRAM_STARS_PRODUCTS[3]);
    } else if (category === 'premium') {
      setSelectedProduct(TELEGRAM_PREMIUM_PRODUCTS[0]);
    } else if (category === 'pubg') {
      setSelectedProduct(PUBG_UC_PRODUCTS[1]);
    }
  };

  // Product selection handler
  const handleSelectProduct = (product: ProductItem) => {
    setSelectedProduct(product);
    if (product.requiresAdmin) {
      sfx.playAdminAlert();
      setIsAdminModalOpen(true);
    } else if (product.category === 'stars') {
      sfx.playStarChime();
    } else {
      sfx.playSelect();
    }
  };

  // Buy action
  const handleInitiatePurchase = (product: ProductItem) => {
    if (product.requiresAdmin) {
      sfx.playAdminAlert();
      setIsAdminModalOpen(true);
    } else {
      sfx.playFireWhoosh();
      setIsCheckoutOpen(true);
    }
  };

  // Direct bot purchase with auto-selected section
  const handleDirectBotPurchase = async (product: ProductItem) => {
    sfx.playFireWhoosh();

    const orderId = `BOT-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: OrderDetails = {
      id: orderId,
      item: product,
      recipientUsername: '@telegram_user',
      paymentMethod: 'card',
      status: 'completed',
      createdAt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      totalSum: product.price,
      apiResponseMsg: `Telegram Bot orqali #${product.id} bo'limi avtomat tanlandi`,
    };

    await saveOrderToFirebase(newOrder);
    refreshBalanceAndOrders();

    // Automatically transition into Telegram bot with that specific section pre-selected
    openTelegramForProduct(product);
  };

  // Filter products by category and search
  const getCurrentProducts = (): ProductItem[] => {
    let list: ProductItem[] = [];
    if (activeCategory === 'stars') list = TELEGRAM_STARS_PRODUCTS;
    else if (activeCategory === 'premium') list = TELEGRAM_PREMIUM_PRODUCTS;
    else if (activeCategory === 'pubg') list = PUBG_UC_PRODUCTS;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.formattedPrice.toLowerCase().includes(q) ||
        (p.tag && p.tag.toLowerCase().includes(q))
    );
  };

  const currentProducts = getCurrentProducts();

  return (
    <div className="relative min-h-screen bg-[#f0f5fc] text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Dynamic Interactive Particle Canvas (soft cyan/blue embers in light mode) */}
      <FireCanvas fireIntensity={isFireMode ? 'intense' : 'normal'} />

      {/* Top Bar Header strictly conforming to Top Bar Contract */}
      <Header
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isFireMode={isFireMode}
        onToggleFireMode={handleToggleFireMode}
        currentView={currentView}
        onNavigateView={(view) => {
          sfx.playSelect();
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          setCurrentView('shop');
          handleCategoryChange(cat);
        }}
        onOpenAdminModal={() => {
          sfx.playAdminAlert();
          setIsAdminModalOpen(true);
        }}
        onOpenAdminPanel={() => {
          sfx.playSelect();
          setIsAdminPanelOpen(true);
        }}
        onOpenTopUpModal={() => {
          sfx.playSelect();
          setIsTopUpModalOpen(true);
        }}
        onTriggerSecretAdminModal={() => {
          setIsSecretAdminModalOpen(true);
        }}
        ordersCount={ordersCount}
        userBalance={userBalance}
      />

      {/* News Ticker (Yuguruvchi Satr) directly under Header */}
      <NewsTicker
        settings={tickerSettings}
        onOpen1MonthModal={() => {
          sfx.playAdminAlert();
          setIsAdminModalOpen(true);
        }}
      />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28">
        {currentView === 'orders' ? (
          /* Mening Buyurtmalarim View with Recharts Spending History & CoinDrop Status */
          <MyOrdersView
            onBackToShop={() => {
              sfx.playSelect();
              setCurrentView('shop');
            }}
            onOpenReceipt={(order) => {
              sfx.playSelect();
              setCompletedOrder(order);
            }}
            onOpenAdminModal={() => {
              sfx.playAdminAlert();
              setIsAdminModalOpen(true);
            }}
            onOpenTopUpModal={() => {
              sfx.playSelect();
              setIsTopUpModalOpen(true);
            }}
          />
        ) : (
          /* Main Shop View */
          <>
            {/* Hero Section in Clean White & Royal Blue Theme */}
            <section className="relative rounded-3xl overflow-hidden border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-blue-50/60 p-6 sm:p-9 mb-8 shadow-lg shadow-sky-500/5">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                {/* Left Text */}
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 mb-3 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Rasmiy Tezkor Do'kon & CoinDrop API</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black font-display text-slate-900 tracking-tight leading-tight">
                    SOLO <span className="text-[#0098ea]">STARS</span>
                  </h1>

                  <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                    Telegram Stars, Telegram Premium va PUBG Mobile UC eng arzon rasmiy narxlarda.
                    Avtomatlashtirilgan real API va 24/7 ishonchli yetkazib berish!
                  </p>

                  {/* Wallet Balance & Topup Banner */}
                  <div className="mt-4 p-3 bg-white border border-sky-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Shaxsiy Balansingiz:</div>
                        <div className="font-black text-[#0098ea] text-base font-display">
                          {userBalance.toLocaleString('uz-UZ')} so'm
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.playSelect();
                        setIsTopUpModalOpen(true);
                      }}
                      className="py-1.5 px-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/20 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Balansni To'ldirish</span>
                    </button>
                  </div>

                  {/* Payment Card Banner */}
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-sky-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">To'lov kartasi:</div>
                        <div className="font-mono font-bold text-slate-800 text-sm">{OFFICIAL_CARD_NUMBER}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCard}
                      className="py-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCard ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span>{copiedCard ? 'Nusxalandi' : 'Nusxa'}</span>
                    </button>
                  </div>

                  {/* Special Highlight for 1 Month Premium */}
                  <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-md shadow-amber-500/20">
                        <Flame className="w-5 h-5 fill-white" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm sm:text-base">
                          1 Oylik Telegram Premium: <span className="text-[#0098ea] font-display">48 100 so'm</span>
                        </div>
                        <div className="text-xs text-amber-700 font-medium">
                          ★ Faqat admin orqali tezkor ulab beriladi (@{ADMIN_TELEGRAM_USERNAME})
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.playAdminAlert();
                        setIsAdminModalOpen(true);
                      }}
                      className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>Adminga Yozish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right: Mascot 3D Logo Presentation */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative group">
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 opacity-30 blur-lg group-hover:opacity-50 transition-opacity" />
                    <img
                      src={LOGO_IMAGE_PATH}
                      alt="SOLO STARS BOT Mascot"
                      className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full object-cover border-4 border-white shadow-xl transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-xs font-mono font-semibold text-slate-500">Admin: </span>
                    <a
                      href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#0098ea] hover:underline"
                    >
                      @{ADMIN_TELEGRAM_USERNAME}
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Category Selector Tabs */}
            <section className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('stars')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === 'stars'
                        ? 'bg-[#0098ea] text-white shadow-md shadow-sky-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                    <span>Telegram Stars</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCategoryChange('premium')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === 'premium'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Gem className="w-4 h-4" />
                    <span>Telegram Premium</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCategoryChange('pubg')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === 'pubg'
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Gamepad2 className="w-4 h-4" />
                    <span>PUBG Mobile UC</span>
                  </button>
                </div>

                {/* Quick Search */}
                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Qidiruv (masalan: 325, 1 oylik)..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-xs"
                  />
                </div>
              </div>
            </section>

            {/* Product Cards Grid */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <span>Paketni tanlang</span>
                  <span className="text-xs font-normal text-slate-500">
                    ({currentProducts.length} ta mavjud)
                  </span>
                </h2>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5 text-sky-600" />
                  <span>Tanlash uchun kartochka ustiga bosing</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {currentProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedProduct?.id === product.id}
                    onSelect={handleSelectProduct}
                    onDirectBotPurchase={handleDirectBotPurchase}
                  />
                ))}
              </div>
            </section>

            {/* Custom Stars Calculator */}
            {activeCategory === 'stars' && (
              <CustomCalculator
                onSelectCustomProduct={(p) => {
                  setSelectedProduct(p);
                  setIsCheckoutOpen(true);
                }}
              />
            )}

            {/* FAQ & Trust Guarantees */}
            <FAQSection />

            {/* Sticky Mobile/Desktop Bottom Action Bar in Crisp White & Cyan */}
            {selectedProduct && (
              <aside
                aria-label="Xarid paneli"
                className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-sky-200 px-4 py-3 shadow-[0_-5px_25px_rgba(2,132,199,0.15)] animate-in slide-in-from-bottom duration-200"
              >
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex w-10 h-10 rounded-xl bg-sky-50 text-sky-600 items-center justify-center border border-sky-200">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Tanlangan paket:</div>
                      <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                        <span>{selectedProduct.title}</span>
                        <span className="text-[#0098ea] font-black font-display">
                          ({selectedProduct.formattedPrice})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDirectBotPurchase(selectedProduct)}
                      className="py-3 px-5 sm:px-7 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider text-white bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-400 hover:to-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{selectedProduct.title} Olish (Botda ochish)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInitiatePurchase(selectedProduct)}
                      className="py-3 px-3 sm:px-4 rounded-xl font-bold text-xs border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 transition-all cursor-pointer whitespace-nowrap"
                      title="Chek yuklash yoki shaxsiy balansdan to'lash"
                    >
                      <span>Chek/Balans</span>
                    </button>
                  </div>
                </div>
              </aside>
            )}
          </>
        )}
      </main>

      {/* Floating Telegram Chat Button with flame ring animations */}
      <FloatingTelegramChat
        onOpen1MonthPremiumModal={() => {
          sfx.playAdminAlert();
          setIsAdminModalOpen(true);
        }}
        hasBottomBar={!!selectedProduct && currentView === 'shop'}
      />

      {/* Footer in Clean White & Sky-Blue */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_IMAGE_PATH}
              alt="Logo"
              className="w-7 h-7 rounded-full object-cover border border-sky-400 shadow-xs"
            />
            <span className="font-extrabold text-slate-800 font-display">SOLO STARS BOT</span>
            <span>·</span>
            <span>Karta: {OFFICIAL_CARD_NUMBER}</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                sfx.playSelect();
                setCurrentView('orders');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-sky-600 transition-colors cursor-pointer font-medium"
            >
              Buyurtmalarim ({ordersCount})
            </button>
            <button
              onClick={() => setIsSecretAdminModalOpen(true)}
              className="hover:text-sky-600 transition-colors cursor-pointer flex items-center gap-1 font-medium"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>
            <a
              href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-600 transition-colors font-medium"
            >
              Admin: @{ADMIN_TELEGRAM_USERNAME}
            </a>
          </div>

          <div className="text-slate-400">
            © {new Date().getFullYear()} SOLO STARS BOT. Barcha huquqlar himoyalangan.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AdminFastTrackModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        product={
          selectedProduct?.requiresAdmin
            ? selectedProduct
            : TELEGRAM_PREMIUM_PRODUCTS[0]
        }
      />

      <OrderCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        product={selectedProduct}
        onOrderSuccess={(order) => {
          setCompletedOrder(order);
          refreshBalanceAndOrders();
        }}
        onOpenTopUpModal={() => {
          setIsTopUpModalOpen(true);
        }}
        onSwitchToAdminModal={() => {
          setIsAdminModalOpen(true);
        }}
      />

      <OrderReceiptModal
        order={completedOrder}
        onClose={() => setCompletedOrder(null)}
      />

      {/* Balance Top-Up Modal with Shimmer Loading & Verification */}
      <TopUpBalanceModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        onTopUpSubmitted={() => {
          refreshBalanceAndOrders();
        }}
      />

      {/* Secret Admin Password Modal (12345678mironshoh) */}
      <SecretAdminModal
        isOpen={isSecretAdminModalOpen}
        onClose={() => setIsSecretAdminModalOpen(false)}
        onSuccess={() => {
          setIsAdminPanelOpen(true);
        }}
      />

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        onOrderUpdated={() => {
          refreshBalanceAndOrders();
        }}
      />

      {/* Advertisement Popup (with Skip countdown) */}
      {activeAd && (
        <AdPopupModal
          ad={activeAd}
          onClose={() => setActiveAd(null)}
        />
      )}
    </div>
  );
}
