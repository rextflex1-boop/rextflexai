import React, { useState } from 'react';
import {
  Menu,
  ChevronDown,
  Plus,
  Mic,
  Camera,
  ArrowUp,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
} from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

interface SearchWorkspaceProps {
  userEmail: string;
  onLogout: () => void;
}

export const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  userEmail,
  onLogout,
}) => {
  const [query, setQuery] = useState('');
  const [conversation, setConversation] = useState<
    Array<{ role: 'user' | 'model'; text: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSearchSubmit = async () => {
    if (!query.trim() || isSearching) return;

    const userText = query.trim();
    setQuery('');
    setConversation((prev) => [...prev, { role: 'user', text: userText }]);
    setIsSearching(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: userText }],
          persona: 'dost',
          language: 'hinglish',
        }),
      });

      const data = await res.json();
      const reply =
        data.reply || 'Haan bhai, maine yeh check kiya aur yeh raha result!';
      setConversation((prev) => [...prev, { role: 'model', text: reply }]);
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Arre dost, query search karne me thoda network issue aaya. Phirse try karein?',
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between font-sans relative">
      {/* Top Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 bg-white sticky top-0 z-20">
        {/* Left hamburger menu */}
        <button
          onClick={onLogout}
          className="p-2 -ml-2 text-zinc-800 hover:bg-zinc-100 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Back to Login"
        >
          <Menu className="w-6 h-6" />
          <span className="hidden sm:inline text-xs font-medium text-zinc-500">
            Logout
          </span>
        </button>

        {/* Center Google / RextFlex Ai Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center">
            <GoogleIcon className="w-6 h-6" />
          </div>
          <span className="font-bold text-sm text-zinc-900 tracking-tight">RextFlex Ai</span>
        </div>

        {/* Right user email & logout */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 hidden sm:inline max-w-[140px] truncate">
            {userEmail}
          </span>
          <button
            onClick={onLogout}
            className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-full cursor-pointer"
            title="Logout"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <div className="flex-1 flex flex-col justify-center px-4 max-w-lg mx-auto w-full py-6 overflow-y-auto">
        {conversation.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 my-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
              What&apos;s on your mind?
            </h2>
            <p className="mt-2 text-xs text-zinc-500 font-medium">
              Signed in as <span className="font-semibold text-zinc-800">{userEmail}</span>
            </p>
          </div>
        ) : (
          /* Conversation results */
          <div className="space-y-4 py-4 w-full">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-amber-500 text-white flex items-center justify-center shrink-0 text-xs shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-zinc-100 text-zinc-900 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === 'model' && (
                    <div className="mt-2 pt-1 border-t border-zinc-200/60 flex items-center justify-end gap-1.5 text-zinc-500">
                      <button
                        onClick={() => handleCopyText(msg.text, idx)}
                        className="p-1 hover:bg-zinc-200 rounded text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span className="text-[10px]">Copy</span>
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 text-xs shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isSearching && (
              <div className="flex gap-2 items-center text-xs text-zinc-500 animate-pulse pl-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>RextFlex Ai is thinking...</span>
              </div>
            )}
          </div>
        )}

        {/* Input Bar: Real interactive input field with standard typing */}
        <div className="w-full bg-[#f4f6fb] dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-3.5 shadow-sm mt-auto mb-4">
          <div className="px-1 flex items-center">
            <input
              id="search-query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything"
              className="w-full bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden"
              autoFocus
            />
          </div>

          {/* Action buttons inside the pill: +, mic, camera, send */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200/50 mt-2">
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-zinc-200/70 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
              title="Add attachment"
            >
              <Plus className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-10 h-10 rounded-full hover:bg-zinc-200/60 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Voice search"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-full hover:bg-zinc-200/60 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Camera search"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleSearchSubmit}
                disabled={!query.trim() || isSearching}
                className="w-11 h-11 rounded-full bg-[#bed5ff] hover:bg-[#a9c9ff] text-[#00388f] flex items-center justify-center shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Send query"
              >
                <ArrowUp className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
