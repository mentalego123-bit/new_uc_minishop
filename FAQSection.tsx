import React, { useState } from 'react';
import { ChevronDown, ShieldCheck, Zap, Headphones, Flame, CreditCard } from 'lucide-react';
import { ADMIN_TELEGRAM_USERNAME, OFFICIAL_CARD_NUMBER } from '../data/products';
import { sfx } from '../utils/sfx';

interface FAQItem {
  q: string;
  a: string;
  highlight?: boolean;
}

const FAQ_LIST: FAQItem[] = [
  {
    q: "1 oylik Telegram Premium nega faqat admin bilan (48 100 so'm)?",
    a: "Telegram rasmiy platformasi 1 oylik obunani avtomat 'Gift' qilib yuborish imkonini cheklagan. Shuning uchun SOLO STARS administratori (@" + ADMIN_TELEGRAM_USERNAME + ") sizga 48 100 so'm juda arzon narxda xavfsiz va tezkor ulab beradi. Akkaunt parolingiz hech qachon so'ralmaydi!",
    highlight: true,
  },
  {
    q: "To'lov qaysi kartaga o'tkaziladi va chek qanday tekshiriladi?",
    a: "Barcha to'lovlar rasmiy " + OFFICIAL_CARD_NUMBER + " kartasiga amalga oshiriladi. To'lov cheki skrinshotini yuklaysiz va admin uni admin panel orqali tasdiqlaydi.",
    highlight: true,
  },
  {
    q: "Avtomatik API qanday ishlaydi?",
    a: "Buyurtma berilganida tizim provayder API orqali avtomatik profilga Stars yoki UC tashlab beradi. Agar API balansida mablag' yetarli bo'lmasa, tizim 'Admin javobini kuting' rejimiga o'tadi va admin buyurtmani qo'lda tasdiqlaydi.",
  },
  {
    q: "Xarid uchun akkaunt paroli kerakmi?",
    a: "YO'Q! Biz HECH QACHON parolingizni so'ramaymiz. Stars va Premium uchun faqat @username, PUBG UC uchun esa faqat raqamli Character ID kifoya.",
  },
];

export const FAQSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    sfx.playSelect();
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="my-16 max-w-4xl mx-auto px-4">
      {/* Trust Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Tezkor Avtomat</h4>
            <p className="text-xs text-slate-400">1-3 daqiqada hisobingizda</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">100% Rasmiy & Kafolat</h4>
            <p className="text-xs text-slate-400">Parolsiz, xavfsiz ulanish</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">24/7 Admin Yordami</h4>
            <p className="text-xs text-slate-400">@{ADMIN_TELEGRAM_USERNAME}</p>
          </div>
        </div>
      </div>

      {/* Accordion */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold font-display text-white">Ko'p Beriladigan Savollar</h3>
        <p className="text-sm text-slate-400 mt-1">Xarid jarayoni va qoidalar haqida</p>
      </div>

      <div className="space-y-3">
        {FAQ_LIST.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl transition-all border ${
                item.highlight
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {item.highlight && <Flame className="w-4 h-4 text-amber-400 shrink-0" />}
                  <span
                    className={`font-semibold text-sm sm:text-base ${
                      item.highlight ? 'text-amber-200' : 'text-slate-200'
                    }`}
                  >
                    {item.q}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
