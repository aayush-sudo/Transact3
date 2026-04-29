import React, { useState, useEffect } from 'react';
import { Box, Hash, ChevronRight, Pickaxe, Loader, Clock, ArrowRight } from 'lucide-react';
import api from '../services/api';

const generateHash = () => {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * chars.length)];
  return hash;
};

const BlockchainViewer = ({ newTransaction }) => {
  const [blocks, setBlocks] = useState([]);
  const [mining, setMining] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockchain();
    const interval = setInterval(fetchBlockchain, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBlockchain = async () => {
    try {
      const { data } = await api.get('/blockchain');
      setBlocks(data);
    } catch (err) {
      console.error("Failed to fetch blockchain", err);
    } finally {
      setLoading(false);
    }
  };

  const mineBlock = async () => {
    setMining(true);
    try {
      await api.get('/mine');
      await fetchBlockchain();
    } catch (err) {
      console.error(err);
    } finally {
      setMining(false);
    }
  };

  const truncateHash = (hash) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Box size={20} className="text-fintech-accent" />
          Blockchain Viewer
        </h3>
        <button
          onClick={mineBlock}
          disabled={mining}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {mining ? (
            <>
              <Loader size={14} className="animate-spin" />
              Mining...
            </>
          ) : (
            <>
              <Pickaxe size={14} />
              Mine Block
            </>
          )}
        </button>
      </div>

      {/* Mining animation */}
      {mining && (
        <div className="mb-4 bg-fintech-darker rounded-lg p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Pickaxe size={24} className="text-amber-400 animate-bounce" />
            </div>
            <div className="flex-1">
              <p className="text-amber-400 font-medium text-sm">Mining new block...</p>
              <p className="text-xs text-slate-500 mt-0.5">Computing proof of work</p>
              <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-400 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {blocks.map((block, i) => (
          <div key={block.index}>
            <div
              className={`bg-fintech-darker rounded-lg border transition-all duration-300 cursor-pointer hover:border-fintech-accent/50 ${
                expandedBlock === block.index
                  ? 'border-fintech-accent/50'
                  : 'border-slate-700/50'
              } ${i === blocks.length - 1 && !mining ? 'ring-1 ring-fintech-primary/30' : ''}`}
              onClick={() =>
                setExpandedBlock(expandedBlock === block.index ? null : block.index)
              }
            >
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      block.index === 0
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-fintech-accent/20 text-fintech-accent'
                    }`}
                  >
                    #{block.index}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium font-mono">
                      {truncateHash(block.hash)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {block.transactions.length} txn(s) · Nonce: {block.nonce}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-slate-500 transition-transform ${
                    expandedBlock === block.index ? 'rotate-90' : ''
                  }`}
                />
              </div>

              {expandedBlock === block.index && (
                <div className="border-t border-slate-700/50 px-3 pb-3 pt-2 space-y-2">
                  <div className="text-xs">
                    <span className="text-slate-500">Hash: </span>
                    <span className="text-slate-300 font-mono break-all">{block.hash}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Previous: </span>
                    <span className="text-slate-300 font-mono break-all">{block.previousHash}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Timestamp: </span>
                    <span className="text-slate-300">
                      {new Date(block.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Transactions:</span>
                    <ul className="mt-1 space-y-1">
                      {block.transactions.map((tx, j) => (
                        <li
                          key={j}
                          className="bg-slate-800 rounded px-2 py-1 text-slate-300 font-mono"
                        >
                          {typeof tx === 'string' ? tx : `TX: ${tx.sender?.slice(0, 8)}...→ ${tx.receiver?.slice(0, 8)}... (${tx.amount})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Chain link arrow */}
            {i < blocks.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-4 bg-slate-700" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlockchainViewer;
