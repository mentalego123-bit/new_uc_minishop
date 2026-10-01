import React from 'react';
import { Flame, Bell, Sparkles } from 'lucide-react';
import { NewsTickerSettings } from '../types';

interface NewsTickerProps {
  settings: NewsTickerSettings;
  onOpen1MonthModal?: () => void;
}

export const NewsTicker: React.FC<NewsTickerProps> = ({ settings, onOpen1MonthModal }) => {
  if (!settings.isEnabled || settings.items.length === 0) return null;

  return (
    <div className="relative bg-gradient-to-r from-amber-600/20 via-orange-600/30 to-amber-600/20 border-y border-amber-500/30 text-white overflow-hidden py-2 select-none">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-3">
        {/* Static Badge Left */}
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-black text-[11px] uppercase tracking-wider shadow-sm z-10">
          <Flame className="w-3.5 h-3.5 fill-black animate-flame-pulse" />
          <span>Yangiliklar</span>
        </div>

        {/* Marquee Container */}
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee flex items-center gap-8 whitespace-nowrap text-xs font-semibold text-amber-100">
            {/* Repeat items twice for infinite seamless scroll */}
            {[...settings.items, ...settings.items].map((text, idx) => (
              <span
                key={idx}
                onClick={() => {
                  if (text.includes('48.100') && onOpen1MonthModal) {
                    onOpen1MonthModal();
                  }
                }}
                className={`inline-flex items-center gap-2 transition-colors ${
                  text.includes('48.100') ? 'cursor-pointer hover:text-white underline decoration-amber-400' : ''
                }`}
              >
                <span>{text}</span>
                <span className="text-amber-400/60">✦</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
