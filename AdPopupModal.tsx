import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, Flame, Megaphone } from 'lucide-react';
import { Advertisement } from '../types';
import { sfx } from '../utils/sfx';

interface AdPopupModalProps {
  ad: Advertisement;
  onClose: () => void;
}

export const AdPopupModal: React.FC<AdPopupModalProps> = ({ ad, onClose }) => {
  const [countdown, setCountdown] = useState(ad.skipDurationSeconds || 3);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSkip = () => {
    sfx.playSelect();
    onClose();
  };

  const handleAction = () => {
    sfx.playFireWhoosh();
    onClose();
    if (ad.buttonUrl && ad.buttonUrl.startsWith('http')) {
      window.open(ad.buttonUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-[#0e172a] border-2 border-amber-500/50 rounded-3xl p-6 shadow-[0_0_60px_rgba(245,158,11,0.4)] text-white overflow-hidden">
        {/* Top Flame Glow */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-bl from-amber-500/30 via-orange-500/15 to-transparent blur-3xl pointer-events-none" />

        {/* Skip button top right */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
              <Megaphone className="w-3 h-3 text-amber-400" />
              <span>{ad.badgeText || 'Reklama'}</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">SOLO STARS E'loni</span>
          </div>

          <button
            onClick={handleSkip}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              countdown === 0
                ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>{countdown > 0 ? `Skip (${countdown}s)` : 'O\'tkazib yuborish'}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Image if provided */}
        {ad.imageUrl && (
          <div className="relative rounded-2xl overflow-hidden mb-4 border border-slate-700 max-h-48">
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e172a] via-transparent to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="space-y-2 mb-6">
          <h3 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight leading-snug">
            {ad.title}
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleAction}
            className="flex-1 py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <span>{ad.buttonText || 'Batafsil / Xarid'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleSkip}
            className="py-3 px-4 rounded-xl font-bold text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
