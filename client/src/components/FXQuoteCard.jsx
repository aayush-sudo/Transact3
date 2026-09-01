import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react';

const FXQuoteCard = ({ quote, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!quote || !quote.expiresAt) return;
    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(quote.expiresAt) - new Date()) / 1000));
      setTimeLeft(seconds);
      if (seconds === 0 && onExpire) {
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [quote, onExpire]);

  if (!quote) return null;

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div>
          <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">TIME-LIMITED FX QUOTE</span>
          <h3 className="text-sm font-bold text-white font-mono">{quote.quoteId}</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${timeLeft < 10 ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-300'}`}>
          <Clock size={13} />
          <span>{timeLeft}s Validity</span>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3 bg-gray-900/60 rounded-xl p-3 border border-gray-700/30">
        <div>
          <span className="text-[11px] text-gray-400 font-semibold block">You Send</span>
          <span className="text-lg font-black text-white font-mono">{Number(quote.sourceAmount).toLocaleString()} {quote.sourceCurrency}</span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-gray-400 font-semibold block">Recipient Gets</span>
          <span className="text-lg font-black text-emerald-400 font-mono">~{Number(quote.destinationAmount).toLocaleString()} {quote.destinationCurrency}</span>
        </div>
      </div>

      {/* Rate Details Table */}
      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-gray-400">
          <span>Reference Mid-Market Rate</span>
          <span className="text-gray-200">1 {quote.sourceCurrency} = {quote.referenceRate} {quote.destinationCurrency}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Customer FX Rate (Spread: {quote.spreadBps} bps)</span>
          <span className="text-emerald-400 font-bold">1 {quote.sourceCurrency} = {quote.quotedRate} {quote.destinationCurrency}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>FX Cost</span>
          <span className="text-gray-200">${quote.fxCostUSD} USD</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Selected Rail Fee ({quote.selectedRail?.replace('_', ' ')})</span>
          <span className="text-gray-200">${quote.railFeeUSD} USD</span>
        </div>
        <div className="flex justify-between text-gray-200 pt-2 border-t border-gray-700/60 font-bold text-sm">
          <span>Total Transaction Cost</span>
          <span className="text-white">${quote.totalCostUSD} USD</span>
        </div>
      </div>
    </div>
  );
};

export default FXQuoteCard;
