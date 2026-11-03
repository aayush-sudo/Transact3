import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { aiQuery } from '../services/api';
import { Loader2, Sparkles, Bot, CheckCircle, Clock3, ArrowRight, X, Send, Wallet, TrendingUp, RefreshCw, MessageSquare } from 'lucide-react';
import PaymentSchedulingModal from '../components/PaymentSchedulingModal';

const AIAgent = () => {
  const location = useLocation();
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hi! I'm your Transact3 AI Transfer Assistant. I can help you with transfers, wallet balance, currency conversion, FX forecasts, transaction history, and more. Just ask!" }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScheduling, setShowScheduling] = useState(false);
  const [currentParams, setCurrentParams] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [askingForRecipient, setAskingForRecipient] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const processedInitial = useRef(false);
  const messagesEndRef = useRef(null);

  const suggestionChips = [
    'Send 1,000 USD to EUR fastest',
    'Convert 100 USD to INR',
    'Check my wallet balance',
    'FX forecast USD to INR',
    'Compare Western Union with Transact3'
  ];

  // Fetch recipients on mount
  useEffect(() => {
    import('../services/api').then(({ default: api }) => {
      api.get('/user/recipients')
        .then(({ data }) => {
          if (data.success) setRecipients(data.data || []);
        })
        .catch(() => {});
    });
  }, []);

  // Handle initial message from homepage
  useEffect(() => {
    const initialMessage = location.state?.initialMessage;
    if (initialMessage && !processedInitial.current) {
      processedInitial.current = true;
      // Clear the router state
      window.history.replaceState({}, document.title);
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
      const recipientExists = recipients.length === 0 || recipients.some(r => r.email.toLowerCase() === email.toLowerCase());
      if (!recipientExists) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `The email "${email}" is not in your saved recipients. Please enter a valid recipient email. Your saved recipients: ${recipients.map(r => r.email).join(', ')}`
        }]);
        return;
      }
      setRecipientEmail(email);
      setAskingForRecipient(false);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Got it! Recipient email set to: ${email}. Now opening the payment scheduling modal...`
      }]);
      setPendingSchedule(true);
      return;
    }

    setIsLoading(true);
    setFollowUpSuggestions([]);
    try {
      const response = await aiQuery(userPrompt, conversationHistory);
      setIsLoading(false);
      const data = response.data;

      if (!data.success) {
        if (data.requiresClarification) {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: data.clarificationMessage || 'Need more details to help with this transfer.'
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
        if (route) {
          assistantMessage += `\n\nRecommended: ${route.name} - Fee: $${route.feeUSD}, Delivery: ${route.estimatedDelivery}`;
        }
        setCurrentParams({
          ...data.parsed,
          selectedRailId: route?.id || 'REGIONAL_INSTANT'
        });
        setFollowUpSuggestions([
          'Why is this option recommended?',
          'Show me the fastest option',
          'Compare with Western Union',
          'What if I increase the amount?'
        ]);
      } else if (data.actionType === 'BALANCE') {
        setFollowUpSuggestions([
          'Convert some of my balance',
          'Send money to someone',
          'Show transaction history'
        ]);
      } else if (data.actionType === 'CONVERT') {
        setFollowUpSuggestions([
          'Convert a different amount',
          'Check exchange rate forecast',
          'Send money using this rate'
        ]);
      } else if (data.actionType === 'FX_FORECAST') {
        setFollowUpSuggestions([
          'Convert currency now',
          'Compare transfer options',
          'Check another currency pair'
        ]);
      } else if (data.actionType === 'HISTORY') {
        setFollowUpSuggestions([
          'Check wallet balance',
          'Make a new transfer',
          'Convert currency'
        ]);
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        data: data,
        actionType: data.actionType
      }]);

      // Update conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: assistantMessage, parsed: data.parsed }
      ].slice(-20));

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

    if (!recipientEmail) {
      setAskingForRecipient(true);
      const recipientList = recipients.length > 0
        ? `Your saved recipients: ${recipients.map(r => r.email).join(', ')}`
        : 'No saved recipients found. Please add a recipient first.';
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `To schedule this transfer, I need the recipient's email address. ${recipientList}`
      }]);
      return;
    }

    setShowScheduling(true);
  };

  const handleNewConversation = () => {
    setMessages([{ role: 'assistant', content: "Hi! I'm your Transact3 AI Transfer Assistant. I can help you with transfers, wallet balance, currency conversion, FX forecasts, transaction history, and more. Just ask!" }]);
    setConversationHistory([]);
    setCurrentParams(null);
    setRecipientEmail('');
    setFollowUpSuggestions([]);
    setInput('');
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
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Transact3 AI Agent</h1>
              <p className="text-sm text-slate-500">Your intelligent cross-border transfer assistant.</p>
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

        {/* Suggestion chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {suggestionChips.map((chip, index) => (
            <button
              key={index}
              type="button"
              onClick={() => { setInput(chip); }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-900 transition-colors"
            >
              <Sparkles size={12} />
              {chip}
            </button>
          ))}
        </div>

        {/* Conversation area */}
        <div className="space-y-4 mb-4" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white max-w-[80%]">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm whitespace-pre-line">
                    {msg.content}
                  </div>
                  {msg.actionType === 'TRANSFER' && msg.data?.routeAnalysis?.recommendedRoute && (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-bold text-emerald-900 mb-1">Recommended Route</p>
                      <p className="text-sm font-semibold text-slate-900">{msg.data.routeAnalysis.recommendedRoute.name}</p>
                      <p className="text-xs text-slate-600">Fee: ${msg.data.routeAnalysis.recommendedRoute.feeUSD} · Delivery: {msg.data.routeAnalysis.recommendedRoute.estimatedDelivery}</p>
                      <button
                        type="button"
                        onClick={handleScheduleTransfer}
                        className="mt-2 btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                      >
                        Schedule Transfer <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                  {msg.actionType === 'BALANCE' && msg.data?.data && (
                    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-bold text-sky-900 mb-1">Wallet Holdings</p>
                      {msg.data.data.holdings?.map((h, i) => (
                        <p key={i} className="text-xs text-slate-700">{h.currency}: {h.amount}</p>
                      ))}
                      <p className="text-xs font-semibold text-slate-900 mt-1">Total: ${msg.data.data.totalValueUSD} USD</p>
                    </div>
                  )}
                  {msg.actionType === 'COMPETITOR_COMPARISON' && msg.data?.data?.providerQuotes && (
                    <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
                      <p className="text-xs font-bold text-purple-900 mb-1">Provider Comparison</p>
                      {msg.data.data.providerQuotes.map((p, i) => (
                        <div key={i} className="text-xs text-slate-700 mb-1">
                          <span className="font-semibold">{p.name}</span>: Rate {p.rate ? Number(p.rate).toFixed(4) : 'N/A'}, Fee {p.fee != null ? Number(p.fee).toFixed(2) : 'N/A'}, Recipient gets {p.receivedAmount ? Number(p.receivedAmount).toFixed(2) : 'N/A'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            </div>
          )}
          {askingForRecipient && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm shadow-sm">
                Please enter the recipient's email address:
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
        <div className="border-t border-slate-200 pt-6 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={askingForRecipient ? "Enter recipient email..." : "Ask anything: balance, convert, transfer, forecast..."}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              id="ai-send-btn"
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <Sparkles size={16} />
              {askingForRecipient ? 'Submit' : 'Ask AI'}
            </button>
          </div>
          <div className="mt-2">
            <Link to="/payment-router" className="btn-secondary inline-flex items-center justify-center gap-2 text-xs font-medium">
              View full comparison <ArrowRight size={14} />
            </Link>
          </div>
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