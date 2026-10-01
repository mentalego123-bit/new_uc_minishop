import React, { useState } from 'react';
import { Lock, X, KeyRound, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { sfx } from '../utils/sfx';

interface SecretAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SecretAdminModal: React.FC<SecretAdminModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === '12345678mironshoh') {
      sfx.playUdarStrike();
      setPassword('');
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
      sfx.playAdminAlert();
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0f172a] border-2 border-sky-500 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">
            Admin Panelga Kirish
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maxfiy parolni kiriting (3 marta logo bosildi)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-sky-500 absolute left-3.5 top-3" />
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Parolni kiriting..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-sky-500 font-mono text-slate-900 dark:text-white"
              />
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Parol noto'g'ri! Qayta urinib ko'ring.</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Tasdiqlash & Kirish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
