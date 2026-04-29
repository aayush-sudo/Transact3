import React, { useState, useEffect } from 'react';
import { Box, ChevronRight, Pickaxe, Loader } from 'lucide-react';
import api from '../services/api';

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
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-velto-ink flex items-center gap-2">
          <div className="p-1.5 bg-velto-forest rounded-lg">
            <Box size={15} className="text-velto-lime" />
          </div>
          Blockchain Viewer
        </h3>
        <button
          onClick={mineBlock}
          disabled={mining}
          className="btn-lime flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-40"
        >
          {mining ? (
            <><Loader size={13} className="animate-spin" /> Mining...</>
          ) : (
            <><Pickaxe size={13} /> Mine Block</>
          )}
        </button>
      </div>

      {/* Mining animation */}
      {mining && (
        <div className="mb-4 bg-velto-surface rounded-xl p-4 border border-velto-lime/30">
          <div className="flex items-center gap-3">
            <Pickaxe size={22} className="text-velto-forest animate-bounce" />
            <div className="flex-1">
              <p className="text-velto-forest font-semibold text-sm">Mining new block...</p>
              <p className="text-xs text-velto-muted mt-0.5">Computing proof of work</p>
              <div className="mt-2 w-full bg-velto-surface-dark rounded-full h-1.5 overflow-hidden">
                <div className="bg-velto-lime h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-velto-lime" />
          </div>
        ) : (
          blocks.map((block, i) => (
            <div key={block.index}>
              <div
                className={`bg-velto-surface rounded-xl border transition-all duration-200 cursor-pointer ${
                  expandedBlock === block.index
                    ? 'border-velto-forest'
                    : 'border-velto-surface-dark hover:border-velto-forest/40'
                } ${i === blocks.length - 1 && !mining ? 'ring-2 ring-velto-lime/40' : ''}`}
                onClick={() => setExpandedBlock(expandedBlock === block.index ? null : block.index)}
              >
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                        block.index === 0
                          ? 'bg-velto-surface-dark text-velto-muted'
                          : 'bg-velto-forest text-velto-lime'
                      }`}
                    >
                      #{block.index}
                    </div>
                    <div>
                      <p className="text-sm text-velto-ink font-semibold font-mono">
                        {truncateHash(block.hash)}
                      </p>
                      <p className="text-xs text-velto-faint">
                        {block.transactions.length} txn(s) · Nonce: {block.nonce}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={15}
                    className={`text-velto-muted transition-transform ${
                      expandedBlock === block.index ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {expandedBlock === block.index && (
                  <div className="border-t border-velto-surface-dark px-3 pb-3 pt-2 space-y-2">
                    <div className="text-xs">
                      <span className="text-velto-faint font-semibold">Hash: </span>
                      <span className="text-velto-ink font-mono break-all">{block.hash}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-velto-faint font-semibold">Previous: </span>
                      <span className="text-velto-ink font-mono break-all">{block.previousHash}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-velto-faint font-semibold">Timestamp: </span>
                      <span className="text-velto-ink">{new Date(block.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-velto-faint font-semibold">Transactions:</span>
                      <ul className="mt-1 space-y-1">
                        {block.transactions.map((tx, j) => (
                          <li
                            key={j}
                            className="bg-white rounded-lg px-2 py-1 text-velto-muted font-mono border border-velto-surface-dark"
                          >
                            {typeof tx === 'string' ? tx : `TX: ${tx.sender?.slice(0, 8)}...→ ${tx.receiver?.slice(0, 8)}... (${tx.amount})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Chain link */}
              {i < blocks.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-0.5 h-4 bg-velto-surface-dark" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BlockchainViewer;
