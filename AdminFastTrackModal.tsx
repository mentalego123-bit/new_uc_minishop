import React, { useState } from 'react';
import { X, Send, Copy, Check, ShieldCheck, Flame, MessageSquare, AlertCircle } from 'lucide-react';
import { ProductItem } from '../types';
import { ADMIN_TELEGRAM_USERNAME } from '../data/products';
import { sfx } from '../utils/sfx';
import { saveOrderToFirebase } from '../services/firebase';

interface AdminFastTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductItem;
}

export const AdminFastTrackModal: React.FC<AdminFastTrackModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [username, setUsername] = useState('');
  const [copied, setCopied] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  if (!isOpen) return null;

  const targetItem = product || {
    id: 'tg-prem-1m',
    title: '1 Oylik Telegram Premium',
    formattedPrice: "48 100 so'm",
  };

  const cleanUsername = username.trim().replace(/^@/, '');
  const readyMessage = `Salom admin! SOLO STARS do'konidan ${targetItem.title} (${targetItem.formattedPrice}) olmoqchiman.\nUsername: @${cleanUsername || 'username'}\nIltimos, rekvizit bering!`;

  const telegramLink = `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(
    readyMessage
  )}`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(readyMessage);
    setCopied(true);
    sfx.playSuccess();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendDirectRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanUsername) return;
    sfx.playUdarStrike();
    setRequestSent(true);

    const adminOrder: any = {
      id: `SS-ADM-${Math.floor(100000 + Math.random() * 900000)}`,
      item: {
        id: targetItem.id,
        category: 'premium',
        title: targetItem.title,
        price: 48100,
        formattedPrice: targetItem.formattedPrice,
        requiresAdmin: true,
        unit: 'Oy',
      },
      recipientUsername: `@${cleanUsername}`,
      paymentMethod: 'click',
      status: 'admin_action_required',
      createdAt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      totalSum: 48100,
    };
    saveOrderToFirebase(adminOrder).catch((err) => console.warn(err));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0f172a] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-white overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-white animate-flame-pulse">
            <Flame className="w-6 h-6 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                Maxsus Admin Xizmati
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                1 Oylik Premium
              </span>
            </div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">
              Telegram Premium (1 Oylik)
            </h2>
          </div>
        </div>

        {/* Notice Box */}
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 mb-6 text-sm text-amber-200/90 leading-relaxed flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">
              Diqqat: 1 oylik obuna faqat admin orqali ulanadi!
            </p>
            <p className="text-xs text-amber-200/80 mt-1">
              Narxi atigi <span className="font-bold text-white bg-amber-500/30 px-1.5 py-0.5 rounded">48 100 so'm</span>.
              Admin sizning profilingizga 3-5 daqiqada ulab beradi.
            </p>
          </div>
        </div>

        {!requestSent ? (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Telegram Username yoki Telefon raqamingiz:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="@username (masalan: @solo_user)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-sm font-medium transition-colors"
                />
              </div>
            </div>

            {/* Quick Telegram Actions */}
            <div className="space-y-3">
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sfx.playFireWhoosh()}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Telegramda Adminga Yozish (@{ADMIN_TELEGRAM_USERNAME})</span>
              </a>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Xabar nusxalandi!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Tayyor matnni nusxalash</span>
                  </>
                )}
              </button>
            </div>

            {/* Guarantees */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>100% Rasmiy & Xavfsiz</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>O'rtacha javob: 2 daqiqa</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">So'rov yuborildi!</h3>
            <p className="text-sm text-slate-300 max-w-sm mx-auto">
              Sizning buyurtmangiz navbatga kiritildi. Iltimos, Telegram orqali ham adminga xabar qoldiring:
            </p>
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl text-sm transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Adminga o'tish</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
