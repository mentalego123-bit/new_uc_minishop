import React from 'react';
import { Check, Flame, ShieldAlert, Sparkles, Send, ArrowRight } from 'lucide-react';
import { ProductItem } from '../types';

interface ProductCardProps {
  product: ProductItem;
  isSelected: boolean;
  onSelect: (product: ProductItem) => void;
  onDirectBotPurchase?: (product: ProductItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onSelect,
  onDirectBotPurchase,
}) => {
  const is1MonthAdmin = product.requiresAdmin;

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group relative w-full text-left rounded-3xl p-5 sm:p-6 transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? 'bg-white border-2 border-[#0098ea] shadow-[0_0_25px_rgba(0,152,234,0.22)] scale-[1.01]'
          : 'bg-white border border-slate-200/80 hover:border-sky-300 hover:shadow-md shadow-sm'
      }`}
    >
      {/* Selection Checkmark Top Right */}
      {isSelected && (
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5 text-[#0098ea]">
          <Check className="w-6 h-6 stroke-[3]" />
        </div>
      )}

      {/* Special Admin Corner Aura */}
      {is1MonthAdmin && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/15 via-orange-500/10 to-transparent pointer-events-none rounded-tr-3xl" />
      )}

      <div className="flex flex-col gap-2 min-h-[110px] justify-between">
        <div>
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 font-display">
              {product.title}
            </h3>

            {is1MonthAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200">
                Maxsus
              </span>
            )}
          </div>

          {/* Flame Tag if available */}
          {product.tag && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {is1MonthAdmin ? (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              )}
              <span>{product.tag}</span>
            </div>
          )}
        </div>

        {/* Signature Cyan-Blue Price & Quick Action */}
        <div className="mt-3 pt-1 flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[#0098ea] tracking-tight font-display">
              {product.formattedPrice}
            </div>

            {is1MonthAdmin ? (
              <div className="mt-1 text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <span>★ Admin bilan tezkor ulanadi</span>
              </div>
            ) : product.bonus ? (
              <div className="mt-1 text-[11px] text-emerald-600 font-medium">
                ✓ {product.bonus}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400 font-medium">
                Tezkor avtomat yetkazish
              </div>
            )}
          </div>

          {/* Direct "Botda Olish" button */}
          {onDirectBotPurchase && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDirectBotPurchase(product);
              }}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Olish</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
