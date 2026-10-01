import React, { useState } from 'react';
import { X, Check, Copy, Send, Sparkles, Clock, ShieldCheck, Flame, CreditCard, AlertCircle } from 'lucide-react';
import { OrderDetails } from '../types';
import { ADMIN_TELEGRAM_USERNAME, OFFICIAL_CARD_NUMBER, LOGO_IMAGE_PATH } from '../data/products';
import { sfx } from '../utils/sfx';

interface OrderReceiptModalProps {
  order: OrderDetails | null;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({ order, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const is1MonthAdmin = order.item.requiresAdmin || order.status === 'admin_action_required';
  const isApiWaiting = order.apiDispatchStatus === 'insufficient_funds';

  const receiptText = `★ SOLO STARS XARID CHEKI ★\nOrder ID: ${order.id}\nMahsulot: ${order.item.title}\nNarxi: ${order.item.formattedPrice}\nQabul qiluvchi: ${order.recipientUsername}\nTo'lov usuli: ${order.paymentMethod.toUpperCase()} (${OFFICIAL_CARD_NUMBER})\nVaqti: ${order.createdAt}\nHolati: ${order.status}\nAdmin: @${ADMIN_TELEGRAM_USERNAME}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    sfx.playSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const telegramLink = `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(receiptText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f172a] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.3)] text-white overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo and Status */}
        <div className="text-center mb-5">
          <img
            src={LOGO_IMAGE_PATH}
            alt="SOLO STARS"
            className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-amber-400 shadow-lg object-cover"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {order.status === 'completed'
              ? 'Xarid muvaffaqiyatli amalga oshirildi!'
              : 'Buyurtma qabul qilindi!'}
          </span>
          <h2 className="text-2xl font-black font-display text-white mt-0.5">
            Rasmiy To'lov Cheki
          </h2>
        </div>

        {/* API Insufficient funds notice (as requested by user) */}
        {isApiWaiting && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">
                API balansida mablag' yo'q — admin javobini kuting!
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Admin (@{ADMIN_TELEGRAM_USERNAME}) to'lovni tasdiqlab, buyurtmangizni 1-5 daqiqada ulab beradi.
              </p>
            </div>
          </div>
        )}

        {/* Receipt Box */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300 font-mono">
          <div className="flex justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-500">Tranzaksiya ID:</span>
            <span className="font-bold text-cyan-400">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Mahsulot:</span>
            <span className="font-bold text-white">{order.item.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Narx:</span>
            <span className="font-bold text-cyan-400 text-sm">{order.item.formattedPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Qabul qiluvchi:</span>
            <span className="font-bold text-amber-400">{order.recipientUsername}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">To'lov kartasi:</span>
            <span className="text-slate-200">{OFFICIAL_CARD_NUMBER}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vaqti:</span>
            <span className="text-slate-300">{order.createdAt}</span>
          </div>

          {/* Receipt Image if available */}
          {order.receiptImageUrl && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-slate-500 block mb-1">Yuklangan chek:</span>
              <img
                src={order.receiptImageUrl}
                alt="Yuklangan chek"
                className="w-full max-h-36 object-contain rounded-xl border border-slate-700 bg-black/40"
              />
            </div>
          )}

          <div className="flex justify-between pt-2 border-t border-slate-800 items-center">
            <span className="text-slate-500">Holat:</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                {order.status === 'completed'
                  ? 'Bajarildi (API)'
                  : is1MonthAdmin
                  ? 'Admin tasdiqlashi kutilmoqda'
                  : 'Bajarilmoqda (1-3 daqiqa)'}
              </span>
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-5 space-y-2.5">
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sfx.playFireWhoosh()}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Adminga Chekni Yuborish (@{ADMIN_TELEGRAM_USERNAME})</span>
          </a>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Nusxalandi!' : 'Chekni Nusxalash'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 font-semibold rounded-xl text-xs transition-colors border border-cyan-500/30 cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
