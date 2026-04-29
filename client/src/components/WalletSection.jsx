import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Wallet, Copy, ExternalLink, Zap } from 'lucide-react';

const WalletSection = () => {
  const { user, walletAddress, walletBalance, connectWallet } = useContext(AuthContext);
  const [copied, setCopied] = React.useState(false);

  const balance = walletBalance || user?.walletBalance || 0;

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
      {/* Lime accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-velto-lime rounded-t-2xl" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-velto-forest rounded-xl">
            <Wallet className="text-velto-lime" size={18} />
          </div>
          <h3 className="text-base font-bold text-velto-ink">Wallet</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-velto-surface text-velto-forest px-3 py-1 rounded-full text-xs font-bold border border-velto-surface-dark">
          <Zap size={11} />
          Polygon
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-velto-muted text-xs font-semibold uppercase tracking-wider mb-1">Total Balance</p>
        <p className="text-3xl font-bold text-velto-ink">
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Wallet Address */}
      {walletAddress ? (
        <div className="bg-velto-surface rounded-xl px-4 py-3 flex items-center justify-between border border-velto-surface-dark">
          <div>
            <p className="text-xs text-velto-faint mb-0.5 font-medium">Wallet Address</p>
            <p className="text-sm text-velto-ink font-mono">{truncateAddress(walletAddress)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-velto-surface-dark rounded-lg transition-colors text-velto-muted hover:text-velto-ink"
              title="Copy"
            >
              <Copy size={13} />
            </button>
            <a
              href={`https://polygonscan.com/address/${walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-velto-surface-dark rounded-lg transition-colors text-velto-muted hover:text-velto-ink"
              title="View on Explorer"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
        >
          <Wallet size={15} />
          Connect Wallet
        </button>
      )}
      {copied && (
        <p className="text-xs text-velto-forest mt-2 text-center font-semibold">Address copied!</p>
      )}
    </div>
  );
};

export default WalletSection;
