import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Copy,
  Check,
  Upload,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Wallet
} from 'lucide-react';
import { OFFICIAL_CARD_NUMBER, OFFICIAL_CARD_HOLDER, ADMIN_TELEGRAM_USERNAME } from '../data/products';
import { createTopUpRequest } from '../services/walletService';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { sfx } from '../utils/sfx';

interface TopUpBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopUpSubmitted: () => void;
}

export const TopUpBalanceModal: React.FC<TopUpBalanceModalProps> = ({
  isOpen,
  onClose,
  onTopUpSubmitted,
}) => {
  const [amount, setAmount] = useState<number>(50000);
  const [username, setUsername] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [copiedCard, setCopiedCard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingState, setIsVerifyingState] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleCopyCard = () => {
    navigator.clipboard.writeText(OFFICIAL_CARD_NUMBER.replace(/\s+/g, ''));
    setCopiedCard(true);
    sfx.playSuccess();
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageToDataUrl(file);
      setReceiptImage(compressed);
      sfx.playSelect();
    } catch {
      setErrorMessage("Chek rasmini yuklashda xatolik yuz berdi!");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim()) {
      setErrorMessage('Iltimos, Telegram @username kiriting!');
      sfx.playAdminAlert();
      return;
    }

    if (!receiptImage) {
      setErrorMessage("Iltimos, to'lov cheki rasmini yuklang!");
      sfx.playAdminAlert();
      return;
    }

    setIsSubmitting(true);
    sfx.playFireWhoosh();

    // Shimmer loading animation simulation for 1.2s then transition to 'Tekshirilmoqda'
    setTimeout(() => {
      createTopUpRequest(username, amount, receiptImage);
      setIsSubmitting(false);
      setIsVerifyingState(true);
      sfx.playSuccess();
      onTopUpSubmitted();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0e1628] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-white overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black shadow-lg shadow-amber-500/30">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-white tracking-tight">
              Balansni To'ldirish
            </h2>
            <p className="text-xs text-slate-400">
              Kartaga to'lab, chekni yuklang — admin tasdiqlaydi
            </p>
          </div>
        </div>

        {/* State: Tekshirilmoqda with Shimmer effect */}
        {isVerifyingState ? (
          <div className="py-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            {/* Shimmer box */}
            <div className="relative p-5 rounded-2xl bg-slate-900 border border-amber-500/40 overflow-hidden">
              <div className="absolute inset-0 animate-shimmer pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 animate-pulse">
                  <Clock className="w-6 h-6 animate-spin" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Holat: Tekshirilmoqda</span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  To'lov cheki qabul qilindi!
                </h3>
                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                  Admin (@{ADMIN_TELEGRAM_USERNAME}) to'lovni 1-3 daqiqada tasdiqlaydi va hisobingizga{' '}
                  <span className="text-amber-400 font-bold">{amount.toLocaleString('uz-UZ')} so'm</span> o'tkaziladi.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Tushundim / Asosiy menyu
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                To'ldirish summasi (so'm):
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[30000, 50000, 100000, 200000, 300000, 500000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setAmount(val);
                      sfx.playSelect();
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      amount === val
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {val.toLocaleString('uz-UZ')}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={10000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Telegram @username:
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Card info */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/30">
              <div className="flex items-center justify-between text-[11px] text-amber-400 mb-1">
                <span>To'lov uchun karta (Humo/Uzcard):</span>
                <span>{OFFICIAL_CARD_HOLDER}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-black text-white">
                  {OFFICIAL_CARD_NUMBER}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCard}
                  className="py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedCard ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCard ? 'Nusxa olindi' : 'Nusxa'}</span>
                </button>
              </div>
            </div>

            {/* Receipt Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>To'lov cheki skrinshotini yuklang:</span>
                <span className="text-amber-400 text-[11px]">Majburiy</span>
              </label>

              <div className="relative border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl p-3 bg-slate-900/60 text-center transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {receiptImage ? (
                  <div className="flex items-center justify-center gap-3">
                    <img
                      src={receiptImage}
                      alt="Chek"
                      className="w-12 h-12 object-cover rounded-lg border border-amber-500/50"
                    />
                    <div className="text-left text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Chek rasm tanlandi</span>
                      </span>
                      <span className="text-slate-400 block text-[11px]">Boshqa rasm uchun bosing</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 flex flex-col items-center justify-center gap-1 text-slate-400">
                    <Upload className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-medium">To'lov chekini yuklash</span>
                    <span className="text-[10px] text-slate-500">Skrinshot yoki kvitansiya</span>
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit CTA with shimmer loading preview */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isSubmitting ? 'animate-shimmer' : ''
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-black" />
                  <span>Chek yuborilmoqda & Tekshirilmoqda...</span>
                </div>
              ) : (
                <>
                  <span>To'lovni Tasdiqlashga Yuborish</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
