import React, { useState } from 'react';
import { Calculator, Sparkles, ArrowRight, Star } from 'lucide-react';
import { ProductItem } from '../types';
import { sfx } from '../utils/sfx';

interface CustomCalculatorProps {
  onSelectCustomProduct: (product: ProductItem) => void;
}

export const CustomCalculator: React.FC<CustomCalculatorProps> = ({ onSelectCustomProduct }) => {
  const [starsAmount, setStarsAmount] = useState<number>(100);
  const RATE_PER_STAR = 201; // approximately 201 so'm per star based on 100 stars = 20 100 so'm

  const totalSom = Math.round(starsAmount * RATE_PER_STAR);
  const formattedTotal = `${totalSom.toLocaleString('uz-UZ')} so'm`;

  const handleAmountChange = (val: number) => {
    const clamped = Math.max(15, Math.min(50000, isNaN(val) ? 0 : val));
    setStarsAmount(clamped);
    sfx.playSelect();
  };

  const handleBuyCustom = () => {
    sfx.playFireWhoosh();
    const customProduct: ProductItem = {
      id: `custom-stars-${starsAmount}`,
      category: 'stars',
      title: `${starsAmount} Stars (Maxsus)`,
      quantity: starsAmount,
      unit: 'Stars',
      price: totalSom,
      formattedPrice: formattedTotal,
      tag: '★ Maxsus miqdor',
      tagType: 'popular',
    };
    onSelectCustomProduct(customProduct);
  };

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1527] to-slate-900 border border-cyan-500/30 p-6 sm:p-8 shadow-xl overflow-hidden my-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
            <Calculator className="w-3.5 h-3.5" />
            <span>Kalkulyator</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
            Ixtiyoriy miqdorda Telegram Stars oling
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Kerakli yulduzlar sonini kiriting, tizim avtomatik eng arzon narxda hisoblab beradi.
          </p>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[50, 100, 250, 500, 1000, 2500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAmountChange(preset)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  starsAmount === preset
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset} Stars
              </button>
            ))}
          </div>
        </div>

        {/* Input & Price Calculator Card */}
        <div className="w-full md:w-80 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-inner">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Yulduzlar soni:</span>
                <span className="text-amber-400 text-xs font-mono">Min: 15 / Max: 50 000</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={15}
                  max={50000}
                  value={starsAmount}
                  onChange={(e) => handleAmountChange(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-cyan-400"
                />
                <Star className="absolute right-3 top-3 w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Jami to'lov:</span>
              <span className="text-xl font-black text-cyan-400 font-display">
                {formattedTotal}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBuyCustom}
            className="mt-4 w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer"
          >
            <span>Xarid Qilish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
