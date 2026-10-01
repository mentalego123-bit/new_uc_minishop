import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Flame, Send, Package, Shield, Wallet, Plus } from 'lucide-react';
import { ADMIN_TELEGRAM_USERNAME, LOGO_IMAGE_PATH } from '../data/products';
import { sfx } from '../utils/sfx';

interface HeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  isFireMode: boolean;
  onToggleFireMode: () => void;
  currentView: 'shop' | 'orders';
  onNavigateView: (view: 'shop' | 'orders') => void;
  activeCategory: string;
  onSelectCategory: (cat: 'stars' | 'premium' | 'pubg') => void;
  onOpenAdminModal: () => void;
  onOpenAdminPanel: () => void;
  onOpenTopUpModal: () => void;
  onTriggerSecretAdminModal: () => void;
  ordersCount?: number;
  userBalance?: number;
}

export const Header: React.FC<HeaderProps> = ({
  isMuted,
  onToggleMute,
  isFireMode,
  onToggleFireMode,
  currentView,
  onNavigateView,
  activeCategory,
  onSelectCategory,
  onOpenAdminModal,
  onOpenAdminPanel,
  onOpenTopUpModal,
  onTriggerSecretAdminModal,
  ordersCount = 0,
  userBalance = 0,
}) => {
  const [logoClicks, setLogoClicks] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Secret 3-click logo handler for password prompt (12345678mironshoh)
  const handleLogoTripleClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      sfx.playSelect();

      if (next >= 3) {
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        onTriggerSecretAdminModal();
        return 0;
      }

      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        setLogoClicks(0);
      }, 1500);

      return next;
    });

    onNavigateView('shop');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Wordmark with official logo & 3-click admin secret detector */}
        <button
          onClick={handleLogoTripleClick}
          title="SOLO STARS (3 marta bosilsa maxfiy kirish)"
          className="text-lg sm:text-xl font-extrabold tracking-tight font-display text-slate-900 dark:text-white flex items-center gap-2.5 group hover:text-sky-600 transition-colors cursor-pointer shrink-0"
        >
          <div className="relative">
            <img
              src={LOGO_IMAGE_PATH}
              alt="SOLO STARS BOT"
              className="w-10 h-10 rounded-full object-cover border-2 border-sky-500 shadow-md group-hover:scale-105 transition-transform"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {logoClicks > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center animate-ping">
                {logoClicks}
              </span>
            )}
          </div>
          <div className="flex flex-col text-left">
            <span className="leading-tight flex items-center gap-1">
              <span>SOLO</span>
              <span className="text-sky-600 dark:text-sky-400">STARS</span>
            </span>
          </div>
        </button>

        {/* Zone 2: Clean navigation links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => {
              onNavigateView('shop');
              onSelectCategory('stars');
            }}
            className={`transition-colors hover:text-sky-600 cursor-pointer ${
              currentView === 'shop' && activeCategory === 'stars'
                ? 'text-sky-600 dark:text-sky-400 font-bold underline decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Stars
          </button>
          <button
            onClick={() => {
              onNavigateView('shop');
              onSelectCategory('premium');
            }}
            className={`transition-colors hover:text-sky-600 cursor-pointer ${
              currentView === 'shop' && activeCategory === 'premium'
                ? 'text-sky-600 dark:text-sky-400 font-bold underline decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Premium
          </button>
          <button
            onClick={() => {
              onNavigateView('shop');
              onSelectCategory('pubg');
            }}
            className={`transition-colors hover:text-sky-600 cursor-pointer ${
              currentView === 'shop' && activeCategory === 'pubg'
                ? 'text-sky-600 dark:text-sky-400 font-bold underline decoration-2 underline-offset-8'
                : ''
            }`}
          >
            PUBG UC
          </button>

          {/* Mening Buyurtmalarim (My Orders) */}
          <button
            onClick={() => onNavigateView('orders')}
            className={`transition-colors hover:text-sky-600 cursor-pointer flex items-center gap-1.5 ${
              currentView === 'orders'
                ? 'text-sky-600 dark:text-sky-400 font-bold underline decoration-2 underline-offset-8'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Buyurtmalarim</span>
            {ordersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30">
                {ordersCount}
              </span>
            )}
          </button>

          <a
            href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-600 transition-colors flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs"
          >
            <Send className="w-3.5 h-3.5 text-sky-500" />
            <span>@{ADMIN_TELEGRAM_USERNAME}</span>
          </a>
        </nav>

        {/* Zone 3: Actions & Wallet Balance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* User Wallet Balance button */}
          <button
            type="button"
            onClick={onOpenTopUpModal}
            title="Balansni to'ldirish"
            className="px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm text-sky-800 dark:text-sky-300"
          >
            <Wallet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="font-mono text-[11px] sm:text-xs">
              {userBalance.toLocaleString('uz-UZ')} so'm
            </span>
            <span className="w-4 h-4 rounded bg-sky-600 text-white flex items-center justify-center font-bold text-[10px]">
              +
            </span>
          </button>

          {/* Sound FX Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
            aria-label={isMuted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
            className={`p-1.5 sm:p-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              isMuted
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400'
                : 'bg-sky-50 dark:bg-slate-800 border-sky-300 dark:border-sky-500 text-sky-600 dark:text-sky-400 shadow-sm'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Olov Rejimi Toggle */}
          <button
            onClick={onToggleFireMode}
            title="Olov animatsiyasini kuchaytirish"
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              isFireMode
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 border-sky-400 text-white shadow'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-sky-600'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${isFireMode ? 'text-amber-300 fill-amber-300' : 'text-sky-500'}`} />
            <span className="hidden sm:inline text-[11px]">{isFireMode ? 'Olov: UDAR' : 'Olov'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
