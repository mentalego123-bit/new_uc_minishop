import React, { useState } from 'react';
import { Send, X, MessageSquare, Flame, Sparkles, Check, Copy, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { ADMIN_TELEGRAM_USERNAME, LOGO_IMAGE_PATH } from '../data/products';
import { sfx } from '../utils/sfx';

interface FloatingTelegramChatProps {
  onOpen1MonthPremiumModal?: () => void;
  hasBottomBar?: boolean;
}

export const FloatingTelegramChat: React.FC<FloatingTelegramChatProps> = ({
  onOpen1MonthPremiumModal,
  hasBottomBar = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  const toggleChat = () => {
    if (!isOpen) {
      sfx.playFireWhoosh();
    } else {
      sfx.playSelect();
    }
    setIsOpen(!isOpen);
  };

  const handleCopyAdmin = () => {
    navigator.clipboard.writeText(`@${ADMIN_TELEGRAM_USERNAME}`);
    setCopied(true);
    sfx.playSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickQuestion = (text: string) => {
    sfx.playSelect();
    const url = `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;
    sfx.playUdarStrike();
    const url = `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(customMsg)}`;
    window.open(url, '_blank');
    setCustomMsg('');
    setIsOpen(false);
  };

  return (
    <div
      className={`fixed right-4 sm:right-6 z-40 transition-all duration-300 ${
        hasBottomBar ? 'bottom-20 sm:bottom-24' : 'bottom-6'
      }`}
    >
      {/* Floating Popup Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-32px)] sm:w-96 bg-[#0e1628] border-2 border-amber-500/50 rounded-3xl p-5 shadow-[0_0_50px_rgba(245,158,11,0.35)] text-white animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
          {/* Top animated fire glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-amber-500/25 via-orange-500/15 to-transparent blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={LOGO_IMAGE_PATH}
                  alt="SOLO STARS"
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0e1628] animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm font-display text-white flex items-center gap-1.5">
                  <span>SOLO STARS Admin</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-flame-pulse" />
                </h4>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <span>● Online (@{ADMIN_TELEGRAM_USERNAME})</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick 1 Month Premium Banner inside Chat */}
          <div className="mt-3 p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase text-amber-400">1 Oylik Premium</div>
              <div className="text-xs font-black text-white">48 100 so'm (Faqat admin bilan)</div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpen1MonthPremiumModal) onOpen1MonthPremiumModal();
              }}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl shadow cursor-pointer whitespace-nowrap"
            >
              Ulash →
            </button>
          </div>

          {/* Fast Questions Presets */}
          <div className="mt-3 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">Tezkor savollar:</div>
            {[
              "Salom admin, 1 oylik Premium (48.100 so'm) olmoqchiman",
              "Telegram Stars xarid qilish bo'yicha yordam kerak",
              "PUBG Mobile UC to'lovimni tekshirib bera olasizmi?",
              "Katta hajmda Stars/UC olmoqchiman, chegirma bormi?",
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickQuestion(preset)}
                className="w-full text-left text-xs p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
              >
                <span className="truncate pr-2">{preset}</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>

          {/* Send custom message input */}
          <form onSubmit={handleSendCustom} className="mt-3 pt-2 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder="Savolingizni yozing..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="p-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Footer action */}
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <button
              onClick={handleCopyAdmin}
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>@{ADMIN_TELEGRAM_USERNAME}</span>
            </button>
            <a
              href={`https://t.me/${ADMIN_TELEGRAM_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline font-semibold"
            >
              Telegram ilovasida ochish
            </a>
          </div>
        </div>
      )}

      {/* Floating Main Button with Epic Flame & Ring Glow Animation */}
      <button
        type="button"
        onClick={toggleChat}
        aria-label="Telegram Chat"
        className="relative group flex items-center gap-3 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(14,165,233,0.6)] hover:shadow-[0_0_35px_rgba(245,158,11,0.8)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-cyan-300/60 overflow-hidden"
      >
        {/* Pulsing Ember Halo */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500 via-red-500 to-cyan-500 opacity-60 blur-sm group-hover:opacity-100 animate-pulse pointer-events-none" />

        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          <div className="relative">
            <Send className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
          </div>
          <span className="hidden sm:inline font-display tracking-tight text-white drop-shadow">
            Telegram Chat
          </span>
          <Flame className="w-4 h-4 text-amber-300 fill-amber-300 hidden sm:inline animate-flame-pulse" />
        </span>
      </button>
    </div>
  );
};
