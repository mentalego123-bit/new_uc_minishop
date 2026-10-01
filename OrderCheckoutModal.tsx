import React, { useState } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  Flame,
  CreditCard,
  Sparkles,
  User,
  Gamepad2,
  ArrowRight,
  Upload,
  Copy,
  AlertTriangle,
  Clock,
  Wallet,
  RefreshCw
} from 'lucide-react';
import { ProductItem, PaymentMethod, OrderDetails } from '../types';
import { sfx } from '../utils/sfx';
import { saveOrderToFirebase } from '../services/firebase';
import { dispatchOrderViaApi } from '../services/starsApi';
import { getUserWalletBalance, deductUserWalletBalance } from '../services/walletService';
import { OFFICIAL_CARD_NUMBER, OFFICIAL_CARD_HOLDER, ADMIN_TELEGRAM_USERNAME } from '../data/products';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { openTelegramForProduct } from '../utils/telegramLink';

interface OrderCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  onOrderSuccess: (order: OrderDetails) => void;
  onOpenTopUpModal?: () => void;
  onSwitchToAdminModal?: () => void;
}

export const OrderCheckoutModal: React.FC<OrderCheckoutModalProps> = ({
  isOpen,
  onClose,
  product,
  onOrderSuccess,
  onOpenTopUpModal,
  onSwitchToAdminModal,
}) => {
  const [recipient, setRecipient] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [phone, setPhone] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [copiedCard, setCopiedCard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isShimmerVerifying, setIsShimmerVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !product) return null;

  const userBalance = getUserWalletBalance();
  const hasEnoughBalance = userBalance >= product.price;
  const isPubg = product.category === 'pubg';
  const is1MonthAdmin = product.requiresAdmin;

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
      // Show mini shimmer preview
      setIsShimmerVerifying(true);
      setTimeout(() => setIsShimmerVerifying(false), 1500);
    } catch {
      setErrorMessage("Chek rasmini yuklashda xatolik yuz berdi!");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!recipient.trim()) {
      setErrorMessage(
        isPubg
          ? 'Iltimos, PUBG Character ID raqamingizni kiriting.'
          : 'Iltimos, Telegram @username kiriting.'
      );
      sfx.playAdminAlert();
      return;
    }

    if (paymentMethod === 'balance') {
      if (!hasEnoughBalance) {
        setErrorMessage("Hisobingizda yetarli mablag' mavjud emas! Iltimos, balansni to'ldiring yoki kartaga to'lang.");
        sfx.playAdminAlert();
        return;
      }
    } else if (paymentMethod === 'card' && !receiptImage && !is1MonthAdmin) {
      setErrorMessage("Iltimos, to'lov amalga oshirilgan chek skrinshotini yuklang!");
      sfx.playAdminAlert();
      return;
    }

    setIsProcessing(true);
    sfx.playFireWhoosh();

    const orderId = `SS-${Math.floor(100000 + Math.random() * 900000)}`;

    const newOrder: OrderDetails = {
      id: orderId,
      item: product,
      recipientUsername: recipient.trim(),
      paymentMethod,
      phoneNumber: phone.trim() || undefined,
      status: paymentMethod === 'card' ? 'verifying' : 'processing', // "Tekshirilmoqda" for card receipts
      createdAt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      totalSum: product.price,
      receiptImageUrl: receiptImage || undefined,
    };

    // If paid by balance, deduct user wallet
    if (paymentMethod === 'balance') {
      deductUserWalletBalance(product.price);
    }

    // Call CoinDrop API if not 1-month admin manual
    if (!is1MonthAdmin) {
      const apiResult = await dispatchOrderViaApi(newOrder);

      if (apiResult.status === 'dispatched') {
        newOrder.status = 'completed';
        newOrder.apiDispatchStatus = 'dispatched';
        newOrder.apiResponseMsg = apiResult.message;
        newOrder.coindropOrderId = apiResult.orderId;
      } else if (apiResult.status === 'stuck') {
        // "api qotib qldi qayta tekshri"
        newOrder.status = 'api_stuck';
        newOrder.apiDispatchStatus = 'stuck';
        newOrder.apiResponseMsg = "CoinDrop API serverida qotish yuz berdi — qayta tekshiring!";
      } else {
        // "api balansida pul bolmasa admin javobin kutin deydi bolmasa otkazadi"
        newOrder.status = 'admin_action_required';
        newOrder.apiDispatchStatus = 'insufficient_funds';
        newOrder.apiResponseMsg = apiResult.message;
      }
    } else {
      // 1 month premium
      newOrder.status = 'admin_action_required';
      newOrder.apiResponseMsg = "1 oylik obuna — admin (@stars_oberin) ulab beradi.";
    }

    // Save to Firebase Firestore & local backup
    await saveOrderToFirebase(newOrder);

    // Automatically transition to Telegram bot with pre-selected product
    openTelegramForProduct(product, recipient, paymentMethod);

    setIsProcessing(false);
    sfx.playUdarStrike();
    onOrderSuccess(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1626] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-white overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rasmiy Xarid Oynasi</span>
          </div>
          <h2 className="text-2xl font-extrabold font-display tracking-tight text-white">
            Buyurtmani Rasmiylashtirish
          </h2>
        </div>

        {/* Product summary banner */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider">Mahsulot:</span>
            <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{product.title}</span>
              {product.tag && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                  {product.tag}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">To'lov:</span>
            <div className="text-xl font-black text-cyan-400 font-display">
              {product.formattedPrice}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>
                {isPubg
                  ? 'PUBG Mobile Character ID:'
                  : 'Telegram Username (@username):'}
              </span>
              <span className="text-cyan-400 text-[11px]">
                {isPubg ? 'Raqamlar' : '@ belgisi bilan'}
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                {isPubg ? <Gamepad2 className="w-4 h-4 text-orange-400" /> : <User className="w-4 h-4 text-cyan-400" />}
              </div>
              <input
                type="text"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder={isPubg ? 'Masalan: 5124982143' : '@foydalanuvchi'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Payment Method Selector (Card vs Wallet Balance) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                To'lov usulini tanlang:
              </label>
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>Balansingiz: {userBalance.toLocaleString('uz-UZ')} so'm</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('card');
                  sfx.playSelect();
                }}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard className={`w-4 h-4 ${paymentMethod === 'card' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  {paymentMethod === 'card' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="mt-2 font-bold text-xs">Kartaga to'lash (9860)</div>
                <div className="text-[10px] text-slate-500">Chek yuklash orqali</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('balance');
                  sfx.playSelect();
                }}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  paymentMethod === 'balance'
                    ? 'bg-amber-950/40 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Wallet className={`w-4 h-4 ${paymentMethod === 'balance' ? 'text-amber-400' : 'text-slate-500'}`} />
                  {paymentMethod === 'balance' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="mt-2 font-bold text-xs">Mening Balansimdan</div>
                <div className="text-[10px] text-slate-500">
                  {hasEnoughBalance ? 'Yetarli (Avtomat API)' : 'Mablag\' yetarli emas'}
                </div>
              </button>
            </div>

            {paymentMethod === 'balance' && !hasEnoughBalance && onOpenTopUpModal && (
              <div className="mt-2 flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                <span className="text-amber-300">Balansni to'ldirish kerakmi?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTopUpModal();
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-[11px] cursor-pointer"
                >
                  To'ldirish →
                </button>
              </div>
            )}
          </div>

          {/* If Card Payment: Show Card and Receipt Upload */}
          {paymentMethod === 'card' && (
            <>
              {/* Card Details Box */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-cyan-500/40 shadow-inner">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>To'lov Kartasi (Humo / Uzcard)</span>
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">
                    {OFFICIAL_CARD_HOLDER}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 bg-black/40 p-2.5 rounded-xl border border-slate-700/80">
                  <div className="font-mono text-base font-black tracking-wider text-white">
                    {OFFICIAL_CARD_NUMBER}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCard}
                    className="py-1 px-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {copiedCard ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCard ? 'Nusxalandi' : 'Nusxa'}</span>
                  </button>
                </div>
              </div>

              {/* Receipt Image Upload with Shimmer Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>To'lov chekini yuklang (Skrinshot):</span>
                  <span className="text-amber-400 text-[11px]">Admin tekshiradi</span>
                </label>

                <div className="relative border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-3 bg-slate-900/60 text-center transition-colors">
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
                        className="w-12 h-12 object-cover rounded-lg border border-cyan-500/50"
                      />
                      <div className="text-left text-xs">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Chek yuklandi</span>
                        </span>
                        <span className="text-slate-400 block text-[11px]">Boshqa rasm uchun bosing</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 flex flex-col items-center justify-center gap-1 text-slate-400">
                      <Upload className="w-5 h-5 text-cyan-400" />
                      <span className="text-xs font-medium">To'lov cheki rasmini bu yerga yuklang</span>
                      <span className="text-[10px] text-slate-500">PNG, JPG formatida</span>
                    </div>
                  )}
                </div>

                {/* Shimmer Feedback Banner when receipt uploaded */}
                {(receiptImage || isShimmerVerifying) && (
                  <div className="mt-2 relative p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40 overflow-hidden text-xs flex items-center justify-between">
                    <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                    <div className="relative z-10 flex items-center gap-2 text-amber-300 font-semibold">
                      <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>Chek statusi: Tekshirilmoqda</span>
                    </div>
                    <span className="relative z-10 text-[11px] text-slate-400 font-mono">
                      Admin nazoratida
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 cursor-pointer ${
                isProcessing ? 'animate-shimmer' : ''
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>CoinDrop API & Tranzaksiya bajarilmoqda...</span>
                </div>
              ) : (
                <>
                  <span>
                    {paymentMethod === 'balance'
                      ? `Balansdan to'lash (${product.formattedPrice})`
                      : `To'lovni Tasdiqlashga Yuborish (${product.formattedPrice})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Admin: @{ADMIN_TELEGRAM_USERNAME}</span>
          </div>
          <span>·</span>
          <span>CoinDrop API (v1)</span>
        </div>
      </div>
    </div>
  );
};
