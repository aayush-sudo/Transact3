import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Wallet, Copy, ExternalLink, Zap } from 'lucide-react';

const WalletSection = () => {
  const { user, walletAddress, connectWallet } = useContext(AuthContext);
  const [copied, setCopied] = React.useState(false);

  const balance = user?.walletBalance ?? 10000;

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="card relative overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fintech-primary via-fintech-secondary to-fintech-accent" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-fintech-primary/20 rounded-lg">
            <Wallet className="text-fintech-primary" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">Wallet</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full text-xs font-medium border border-violet-500/20">
          <Zap size={12} />
          Polygon
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-slate-400 text-sm mb-1">Total Balance</p>
        <p className="text-3xl font-bold text-white">
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Wallet Address */}
      {walletAddress ? (
        <div className="bg-fintech-darker rounded-lg px-4 py-3 flex items-center justify-between border border-slate-700/50">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Wallet Address</p>
            <p className="text-sm text-slate-300 font-mono">{truncateAddress(walletAddress)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Copy"
            >
              <Copy size={14} />
            </button>
            <a
              href={`https://polygonscan.com/address/${walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white"
              title="View on Explorer"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <Wallet size={16} />
          Connect Wallet
        </button>
      )}
      {copied && (
        <p className="text-xs text-fintech-primary mt-2 text-center animate-pulse">Address copied!</p>
      )}
    </div>
  );
};

export default WalletSection;
