import { useState, useRef, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { aiQuery } from '../services/api';
import {
  Loader2,
  Sparkles,
  Bot,
  CheckCircle,
  Clock3,
  ArrowRight,
  X,
  Send,
  Wallet,
  TrendingUp,
  RefreshCw,
  MessageSquare,
  Info,
  ShieldCheck,
  Zap,
  Activity,
  UserCheck
} from 'lucide-react';
import PaymentSchedulingModal from '../components/PaymentSchedulingModal';

const CONVERSATION_STORAGE_KEY = 'transact3.ai.conversation';
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GREETING_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your Transact3 AI Transfer Assistant. I can help you with transfers, wallet balance, currency conversion, FX forecasts, transaction history, and our specialized Multi-Agent Society (FX Mandates, Rail Saturation, & Compliance). Just ask!"
};

const createConversationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `conv_${crypto.randomUUID()}`;
  }
  return `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const loadStoredConversation = () => {
  try {
    const raw = window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored || typeof stored.conversationId !== 'string') return null;
    return stored;
  } catch (err) {
    return null;
  }
};

const AIAgent = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const storedConversation = useRef(loadStoredConversation()).current;
  const initialMessages = storedConversation && Array.isArray(storedConversation.messages) && storedConversation.messages.length > 0
    ? storedConversation.messages
    : [GREETING_MESSAGE];
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScheduling, setShowScheduling] = useState(false);
  const [currentParams, setCurrentParams] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [askingForRecipient, setAskingForRecipient] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [conversationId, setConversationId] = useState(
    (storedConversation && storedConversation.conversationId) || createConversationId()
  );
  const [conversationHistory, setConversationHistory] = useState(
    storedConversation && Array.isArray(storedConversation.history) ? storedConversation.history : []
  );
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const processedInitial = useRef(false);
  const messagesEndRef = useRef(null);

  // Keep the structured conversation (id + turns) across refreshes. Only the
  // last turns are stored so long conversations stay bounded.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify({
        conversationId,
        history: conversationHistory.slice(-20),
        messages: messages.slice(-20)
      }));
    } catch (err) {
      // Storage unavailable - conversation still works in memory.
    }
  }, [conversationId, conversationHistory, messages]);

  const suggestionChips = [
    'Send 1,000 USD to EUR fastest',
    'Convert 100 USD to INR',
    'Check my wallet balance',
    'FX forecast USD to INR',
    'Compare Providers',
    'Set autonomous FX mandate for 1,000 USD to INR',
    'Check rail liquidity health',
    'Run compliance screening'
  ];

  // Fetch recipients on mount or auth change
  useEffect(() => {
    import('../services/api').then(({ default: api }) => {
      api.get('/user/recipients')
        .then(({ data }) => {
          if (data.success && Array.isArray(data.data)) {
            setRecipients(data.data);
          }
        })
        .catch(() => {
          // If unauthorized or error, recipients remain empty
        });
    });
  }, [user]);

  // Handle initial message from homepage
  useEffect(() => {
    const initialMessage = location.state?.initialMessage;
    if (initialMessage && !processedInitial.current) {
      processedInitial.current = true;
      // Clear the router state
      window.history.replaceState({}, document.title);
      // A homepage question starts a fresh conversation so no stale context is reused.
      setConversationHistory([]);
      setConversationId(createConversationId());
      setMessages([GREETING_MESSAGE]);
      // Auto-submit the message
      setTimeout(() => {
        setInput(initialMessage);
        // Trigger send after state update
        setTimeout(() => {
          const btn = document.getElementById('ai-send-btn');
          if (btn) btn.click();
        }, 100);
      }, 100);
    }
  }, [location.state]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle pending schedule
  useEffect(() => {
    if (pendingSchedule && currentParams) {
      setPendingSchedule(false);
      setShowScheduling(true);
    }
  }, [pendingSchedule, currentParams]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userPrompt = input;
    setInput('');
    setError('');

    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }]);

    // If asking for recipient email
    if (askingForRecipient) {
      const email = userPrompt.trim();
      if (!EMAIL_ADDRESS_PATTERN.test(email)) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'Please enter a valid recipient email address, or choose one of the saved recipients.'
        }]);
        return;
      }
      setRecipientEmail(email);
      setAskingForRecipient(false);
      setCurrentParams((current) => current ? { ...current, receiverEmail: email } : current);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Got it! Recipient set to: ${email}. Opening payment review & quote...`
      }]);
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: userPrompt },
        {
          role: 'assistant',
          content: 'Recipient selected for the pending transfer.',
          parsed: {
            ...(currentParams || {}),
            intent: 'PAYMENT_SCHEDULING',
            recipientEmail: email
          },
          actionType: 'TRANSFER'
        }
      ].slice(-20));
      setPendingSchedule(true);
      return;
    }

    setIsLoading(true);
    setFollowUpSuggestions([]);
    try {
      const response = await aiQuery(userPrompt, conversationHistory, conversationId);
      setIsLoading(false);
      const data = response.data;

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      }

      const recordTurn = (assistantContent, parsed) => {
        setConversationHistory((prev) => [
          ...prev,
          { role: 'user', content: userPrompt },
          {
            role: 'assistant',
            content: assistantContent,
            parsed,
            actionType: data.actionType || null,
            contextVersion: data.contextVersion != null ? data.contextVersion : null
          }
        ].slice(-20));
      };

      if (!data.success) {
        if (data.requiresClarification) {
          const clarification = data.clarificationMessage || 'Need more details to help with this request.';
          recordTurn(clarification, data.parsed);
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: clarification
          }]);
          setFollowUpSuggestions(['Provide the missing information', 'Start a new query']);
        } else {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Error: ${data.error || 'An error occurred processing your request'}`
          }]);
        }
        return;
      }

      let assistantMessage = data.assistantMessage || 'Here are the results.';

      if (data.actionType === 'TRANSFER' && data.routeAnalysis) {
        const route = data.routeAnalysis.recommendedRoute;
        const parsedEmail = typeof data.parsed?.recipientEmail === 'string'
          ? data.parsed.recipientEmail
          : '';
        setRecipientEmail(parsedEmail);
        setAskingForRecipient(false);
        if (route) {
          assistantMessage += `\n\nRecommended Route: ${route.name} - Fee: $${route.feeUSD}, Delivery: ${route.estimatedDelivery}`;
        }
        setCurrentParams({
          ...data.parsed,
          receiverEmail: parsedEmail,
          selectedRailId: route?.id || 'REGIONAL_INSTANT'
        });
        setFollowUpSuggestions([
          'Why is this option recommended?',
          'Show me the fastest option',
          'Compare with Western Union',
          'What if I increase the amount?'
        ]);
      } else if (data.actionType === 'BALANCE') {
        setCurrentParams(null);
        setFollowUpSuggestions([
          'Convert some of my balance',
          'Send money to someone',
          'Show transaction history'
        ]);
      } else if (data.actionType === 'CONVERT') {
        setCurrentParams(null);
        setFollowUpSuggestions([
          'Check its forecast',
          'Should I convert now or wait?',
          'Compare providers for this'
        ]);
      } else if (data.actionType === 'FX_FORECAST') {
        setCurrentParams(null);
        setFollowUpSuggestions([
          'Should I wait for a better rate?',
          'What about next week?',
          'Compare providers for this'
        ]);
      } else if (data.actionType === 'FX_TIMING_ANALYSIS') {
        setCurrentParams(null);
        setFollowUpSuggestions([
          'Check its forecast',
          'What if I convert 500 instead?',
          'Compare providers for this'
        ]);
      } else if (data.actionType === 'HISTORY') {
        setCurrentParams(null);
        setFollowUpSuggestions([
          'Check wallet balance',
          'Make a new transfer',
          'Convert currency'
        ]);
      }

      recordTurn(assistantMessage, data.parsed);

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        data: data,
        actionType: data.actionType
      }]);
    } catch (err) {
      setIsLoading(false);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err.response?.data?.message || err.message || 'Could not process request'}`
      }]);
    }
  };

  const handleScheduleTransfer = () => {
    if (!currentParams) return;

    const token = localStorage.getItem('token');
    if (!token && !user) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `⚠️ You are currently in guest mode. To schedule and execute real funds transfers, please sign in with an account (e.g. alice@transact3.com / Password123!) using the Login link in the navbar.`
      }]);
      return;
    }

    if (!recipientEmail) {
      setAskingForRecipient(true);
      const recipientList = recipients.length > 0
        ? `Select a saved recipient below or type an email address:`
        : 'Please enter the recipient email address (e.g. bob@transact3.com):';
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `To schedule this transfer, please specify the recipient's email address.\n\n${recipientList}`
      }]);
      return;
    }

    setShowScheduling(true);
  };

  const handleSelectRecipient = (email) => {
    setRecipientEmail(email);
    setAskingForRecipient(false);
    setCurrentParams((current) => current ? { ...current, receiverEmail: email } : current);
    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: `Recipient set to: ${email}. Opening payment review and quote...`
    }]);
    setConversationHistory((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'Recipient selected for the pending transfer.',
        parsed: {
          ...(currentParams || {}),
          intent: 'PAYMENT_SCHEDULING',
          recipientEmail: email
        },
        actionType: 'TRANSFER'
      }
    ].slice(-20));
    setPendingSchedule(true);
  };

  const handleNewConversation = () => {
    setMessages([GREETING_MESSAGE]);
    setConversationHistory([]);
    setConversationId(createConversationId());
    setCurrentParams(null);
    setRecipientEmail('');
    setFollowUpSuggestions([]);
    setInput('');
    try {
      window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
    } catch (err) {
      // Ignore storage failures.
    }
  };

  const handleFollowUp = (suggestion) => {
    setInput(suggestion);
    setTimeout(() => {
      const btn = document.getElementById('ai-send-btn');
      if (btn) btn.click();
    }, 100);
  };

  return (
    <section className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Transact3 Multi-Agent Transfer Assistant</h1>
              <p className="text-sm text-slate-500">Autonomous Predictive Execution, Rail Liquidity, and RegTech Compliance</p>
            </div>
          </div>
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            New Conversation
          </button>
        </header>

        {/* Multi-Agent Society (MAS) Active Showcase */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-xs font-bold tracking-widest uppercase text-emerald-400 font-mono">
                Multi-Agent Society (MAS) • 3 Autonomous Agents Active
              </h2>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              Consensus & Routing Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
            {/* Agent 1 */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3.5 flex flex-col justify-between hover:border-indigo-400/60 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/50 flex items-center justify-center text-indigo-300">
                      <Zap size={15} />
                    </div>
                    <span className="text-xs font-bold text-indigo-200">FX Target-Rate Watcher</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700/50">
                    Reference rates
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                  Monitors the latest available reference rate for your threshold. No validated forecast is connected; settlement is simulated in this prototype.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInput('Set an autonomous FX mandate for 1,000 USD to INR when rate improves by 0.5%');
                }}
                className="mt-3 w-full text-center text-xs font-semibold py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap size={12} /> Deploy FX Mandate
              </button>
            </div>

            {/* Agent 2 */}
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/40 p-3.5 flex flex-col justify-between hover:border-teal-400/60 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-600/50 flex items-center justify-center text-teal-300">
                      <Activity size={15} />
                    </div>
                    <span className="text-xs font-bold text-teal-200">Autonomous Rail & Liquidity</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-900/80 text-teal-300 border border-teal-700/50">
                    Dijkstra Graph
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                  Monitors modeled rail capacity. Intermediate routes stay hidden unless a payment provider confirms executable quotes and availability.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInput('Check rail liquidity health and simulate rebalancing');
                }}
                className="mt-3 w-full text-center text-xs font-semibold py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <Activity size={12} /> Diagnose Rails
              </button>
            </div>

            {/* Agent 3 */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-3.5 flex flex-col justify-between hover:border-amber-400/60 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-600/50 flex items-center justify-center text-amber-300">
                      <ShieldCheck size={15} />
                    </div>
                    <span className="text-xs font-bold text-amber-200">Compliance & RegTech Sentinel</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 border border-amber-700/50">
                    Isolation Forest
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                  BSA $9,000–$9,999 structuring audit, Jaro-Winkler AML sanction checks, and interactive step-ups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInput('Run compliance screening for 9,500 USD to Bob');
                }}
                className="mt-3 w-full text-center text-xs font-semibold py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <ShieldCheck size={12} /> Run Compliance Audit
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {suggestionChips.map((chip, index) => (
            <button
              key={index}
              type="button"
              onClick={() => { setInput(chip); }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-900 hover:bg-white transition-colors shadow-sm"
            >
              <Sparkles size={12} />
              {chip}
            </button>
          ))}
        </div>

        {/* Conversation area */}
        <div className="space-y-4 mb-4" style={{ maxHeight: '550px', overflowY: 'auto' }}>
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white max-w-[80%] shadow-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%]">
                  {/* Agent Provenance Header */}
                  {msg.actionType === 'FX_MANDATE' && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-indigo-700">
                      <Zap size={13} />
                      <span>Predictive FX Execution Agent (Model 1)</span>
                    </div>
                  )}
                  {msg.actionType === 'LIQUIDITY_HEALTH' && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-teal-700">
                      <Activity size={13} />
                      <span>Autonomous Rail & Liquidity Rebalancing Agent (Dijkstra)</span>
                    </div>
                  )}
                  {msg.actionType === 'COMPLIANCE_AGENT' && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                      <ShieldCheck size={13} />
                      <span>Compliance & RegTech Sentinel Agent (Isolation Forest + AML)</span>
                    </div>
                  )}
                  {msg.actionType === 'TRANSFER' && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <Bot size={13} />
                      <span>Multi-Rail Settlement Agent</span>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm whitespace-pre-line text-slate-800 leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Transfer Recommendation Card */}
                  {msg.actionType === 'TRANSFER' && msg.data?.routeAnalysis?.recommendedRoute && (
                    <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 shadow-sm">
                      <p className="text-xs font-bold text-emerald-900 mb-1">Recommended Settlement Route</p>
                      <p className="text-sm font-semibold text-slate-900">{msg.data.routeAnalysis.recommendedRoute.name}</p>
                      <p className="text-xs text-slate-600">Fee: ${msg.data.routeAnalysis.recommendedRoute.feeUSD} · Delivery: {msg.data.routeAnalysis.recommendedRoute.estimatedDelivery}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Modeled estimate; not a binding quote from a connected payment provider.</p>
                      <button
                        type="button"
                        onClick={handleScheduleTransfer}
                        className="mt-2.5 btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 shadow"
                      >
                        Schedule Transfer <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {msg.actionType === 'TRANSFER' && msg.data?.routeComparison && (
                    <div className="mt-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 shadow-sm">
                      <p className="text-xs font-bold text-sky-950">Direct vs. intermediate-currency route</p>
                      {msg.data.routeComparison.directReferenceQuote ? (
                        <p className="mt-1 text-xs text-slate-700">
                          Direct reference estimate: {Number(msg.data.routeComparison.directReferenceQuote.sourceAmount).toLocaleString()} {msg.data.routeComparison.directReferenceQuote.sourceCurrency}
                          {' → '}{Number(msg.data.routeComparison.directReferenceQuote.destinationAmount).toLocaleString()} {msg.data.routeComparison.directReferenceQuote.destinationCurrency}
                          {' · rate '}{Number(msg.data.routeComparison.directReferenceQuote.rate).toPrecision(6)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-700">A current direct reference rate is unavailable.</p>
                      )}
                      <p className="mt-1 text-xs text-slate-600">
                        Hop comparison withheld: reference rates do not confirm per-leg provider fees, corridor availability, or settlement. No third-currency route is recommended.
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Reference rate date: {msg.data.routeComparison.directReferenceQuote?.rateTimestamp
                          ? new Date(msg.data.routeComparison.directReferenceQuote.rateTimestamp).toLocaleDateString()
                          : 'unavailable'} · not a binding transfer quote
                      </p>
                    </div>
                  )}

                  {/* Wallet Balance Card */}
                  {msg.actionType === 'BALANCE' && msg.data?.data && (
                    <div className="mt-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
                      <p className="text-xs font-bold text-sky-900 mb-1.5">Wallet Holdings</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {msg.data.data.holdings?.map((h, i) => (
                          <div key={i} className="text-xs text-slate-700 bg-white/70 px-2 py-1 rounded border border-sky-100 font-mono">
                            {h.currency}: <b>{Number(h.amount).toLocaleString()}</b>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-semibold text-slate-900 mt-2">Total Value: ${msg.data.data.totalValueUSD} USD</p>
                    </div>
                  )}

                  {/* Competitor Comparison Card */}
                  {msg.actionType === 'COMPETITOR_COMPARISON' && msg.data?.data?.providerQuotes && (
                    <div className="mt-2.5 rounded-xl border border-purple-200 bg-purple-50 p-3.5">
                      <p className="text-xs font-bold text-purple-900 mb-1">Provider Comparison</p>
                      {msg.data.data.providerQuotes.map((p, i) => (
                        <div key={i} className="text-xs text-slate-700 mb-1">
                          <span className="font-semibold">{p.name}</span>: Rate {p.rate ? Number(p.rate).toFixed(4) : 'N/A'}, Fee {p.fee != null ? Number(p.fee).toFixed(2) : 'N/A'}, Recipient gets {p.receivedAmount ? Number(p.receivedAmount).toFixed(2) : 'N/A'}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agent 1 Card: FX Mandate */}
                  {msg.actionType === 'FX_MANDATE' && msg.data?.data?.mandate && (
                    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                          ⚡ Autonomous FX Mandate [{msg.data.data.mandate.mandateId}]
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-200 text-indigo-800">
                          {msg.data.data.mandate.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                        <div><span className="text-slate-500">Corridor:</span> {msg.data.data.mandate.amount} {msg.data.data.mandate.sourceCurrency} → {msg.data.data.mandate.destinationCurrency}</div>
                        <div><span className="text-slate-500">Target Rate:</span> ≥ {msg.data.data.mandate.targetRate} (+{msg.data.data.mandate.targetImprovementPct}%)</div>
                        <div><span className="text-slate-500">Current Rate:</span> {msg.data.data.mandate.latestRate}</div>
                        <div><span className="text-slate-500">Forecast:</span> No validated provider connected</div>
                      </div>
                      <p className="text-[11px] text-slate-500 italic">
                        The target watcher uses reference rates; any resulting settlement is simulated and does not send money externally.
                      </p>
                    </div>
                  )}

                  {/* Agent 2 Card: Rail Liquidity */}
                  {msg.actionType === 'LIQUIDITY_HEALTH' && msg.data?.data?.health && (
                    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/80 p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                          📊 Rail Liquidity Diagnosis
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-200 text-teal-800">
                          {msg.data.data.health.systemStatus}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.data.data.health.rails?.map((rail, i) => (
                          <div key={i} className="text-xs flex items-center justify-between p-1.5 rounded-lg bg-white/70 border border-teal-100">
                            <span className="font-medium text-slate-800">{rail.name}</span>
                            <span className="text-slate-600">${Number(rail.availableLiquidityUSD).toLocaleString()} USD ({rail.saturationPct}%)</span>
                          </div>
                        ))}
                      </div>
                      {msg.data.data.plan?.hasProviderConfirmedMultiHop && (
                        <div className="mt-2 p-2 rounded-lg bg-white border border-teal-300 text-xs text-teal-950 font-medium">
                          ⚡ Dijkstra Graph Rerouting: {msg.data.data.plan.graphPath?.join(' → ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent 3 Card: Compliance Sentinel */}
                  {msg.actionType === 'COMPLIANCE_AGENT' && msg.data?.data?.screening && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          🛡️ Compliance & Anomaly Audit
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          msg.data.data.screening.riskLevel === 'LOW' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-900'
                        }`}>
                          Risk Score: {msg.data.data.screening.compositeScore}/100 [{msg.data.data.screening.riskLevel}]
                        </span>
                      </div>
                      {msg.data.data.screening.triggers?.length > 0 ? (
                        <div className="space-y-1">
                          {msg.data.data.screening.triggers.map((t, i) => (
                            <p key={i} className="text-xs text-amber-900">⚠️ <b>{t.code}:</b> {t.description}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700">🟢 No regulatory flags detected. Cleared for Straight-Through Processing.</p>
                      )}
                      {msg.data.data.screening.challenge && (
                        <div className="mt-2 p-2.5 rounded-lg bg-white border border-amber-300 text-xs text-slate-800 space-y-2">
                          <p className="font-semibold text-amber-900">Interactive Compliance Challenge:</p>
                          <p className="text-[11px] text-slate-600">Please provide commercial justification to clear transfer.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setInput(`Commercial purpose for ${msg.data.data.screening.challenge.challengeId}: Vendor invoice settlement`);
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium transition-colors"
                          >
                            Submit Vendor Invoice Justification
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm flex items-center gap-2 text-slate-600">
                <Loader2 size={15} className="animate-spin text-emerald-600" />
                Multi-Agent Society evaluating...
              </div>
            </div>
          )}

          {/* Interactive Recipient Quick-Selector */}
          {askingForRecipient && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm max-w-[85%] space-y-2">
                <p className="font-semibold text-emerald-900">Select Recipient for this transfer:</p>
                {recipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectRecipient(r.email)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-900 font-medium transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <UserCheck size={13} className="text-emerald-700" />
                        <b>{r.name}</b> ({r.email})
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Type a registered email (e.g., <b>bob@transact3.com</b>) into the chat below.
                  </p>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Follow-up suggestions */}
        {followUpSuggestions.length > 0 && !isLoading && (
          <div className="mb-4 flex flex-wrap gap-2">
            {followUpSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleFollowUp(suggestion)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <MessageSquare size={12} />
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-200 pt-5 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={askingForRecipient ? "Enter recipient email (e.g. bob@transact3.com)..." : "Ask anything: send money, balance, FX mandate, rail liquidity, compliance..."}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder:text-slate-400 disabled:opacity-60 bg-white shadow-sm"
            />
            <button
              id="ai-send-btn"
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              <Sparkles size={16} />
              {askingForRecipient ? 'Submit' : 'Ask Agents'}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <Link to="/payment-router" className="btn-secondary inline-flex items-center gap-1.5 text-xs font-medium">
              View full multi-rail comparison <ArrowRight size={13} />
            </Link>
            {user ? (
              <span className="text-slate-600">Logged in as: <b>{user.email}</b></span>
            ) : (
              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Guest Mode: Log in with <b>alice@transact3.com</b> to execute transfers
              </span>
            )}
          </div>
        </div>

        {/* Persistent AI disclaimer */}
        <div
          role="note"
          aria-label="AI-generated response disclaimer"
          className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 sm:text-xs"
        >
          <Info size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            Responses from the Transact3 AI Agent and Multi-Agent Society are generated for financial transfer planning. FX outlooks use dated reference rates only; no validated rate-forecast provider or external payment execution is connected.
          </p>
        </div>

        {/* Scheduling modal */}
        {showScheduling && currentParams && (
          <PaymentSchedulingModal
            isOpen={showScheduling}
            onClose={() => setShowScheduling(false)}
            initialParams={{
              sourceCurrency: currentParams.sourceCurrency || 'USD',
              destinationCurrency: currentParams.destinationCurrency || 'INR',
              amount: currentParams.amount || 0,
              paymentMode: currentParams.paymentMode || 'SEND_AMOUNT',
              priority: currentParams.priority || 'BALANCED',
              receiverEmail: recipientEmail,
              selectedRailId: currentParams.selectedRailId || 'REGIONAL_INSTANT'
            }}
          />
        )}
      </div>
    </section>
  );
};

export default AIAgent;
