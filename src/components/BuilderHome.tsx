import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Mic, 
  ArrowUp, 
  Sparkles, 
  Cpu, 
  Radio, 
  CheckCircle2, 
  Copy, 
  ExternalLink 
} from 'lucide-react';
import { ChatMessage, TabMode, AIModel } from '../types';
import { TopNavbar } from './TopNavbar';
import { LeftDrawer } from './LeftDrawer';
import { UserMenuDropdown } from './UserMenuDropdown';
import { GeneralSettingsModal } from './GeneralSettingsModal';
import { ModelSelectorModal, AVAILABLE_MODELS } from './ModelSelectorModal';
import { WebsitePreview } from './WebsitePreview';
import { api } from '../lib/api';

interface BuilderHomeProps {
  userEmail?: string;
  initialUserName?: string;
  initialAvatarUrl?: string;
  onSignOut: () => void;
  onUserUpdated?: (user: { id: string; email: string; name: string; image?: string | null }) => void;
}

export function BuilderHome({
  userEmail = '',
  initialUserName = '',
  initialAvatarUrl,
  onSignOut,
  onUserUpdated,
}: BuilderHomeProps) {
  // Navigation & Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Tab & Tool states: Chat and Build
  const [activeTab, setActiveTab] = useState<TabMode>('chat');
  const [selectedModel, setSelectedModel] = useState<AIModel>(() => AVAILABLE_MODELS.find((m) => m.id === 'titan') || AVAILABLE_MODELS[0]);
  const [userName, setUserName] = useState(initialUserName);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(initialAvatarUrl);
  const [creditsRemaining, setCreditsRemaining] = useState(15);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat & Website builder states: start clean so only real user messages appear
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | undefined>(undefined);
  const [isMicActive, setIsMicActive] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load the real account preferences and latest persisted conversation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<{ user: { id: string; email: string; name: string; image?: string | null }; modelTier: string }>('/api/me');
        if (cancelled) return;
        setUserName(me.user.name);
        setUserAvatar(me.user.image || undefined);
        onUserUpdated?.(me.user);
        const model = AVAILABLE_MODELS.find((m) => m.id === me.modelTier);
        if (model) setSelectedModel(model);

        const sessions = await api<{ sessions: Array<{ id: string; title?: string }> }>('/api/sessions');
        if (cancelled) return;
        let current = sessions.sessions[0];
        if (!current) {
          const created = await api<{ session: { id: string; title: string } }>('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New conversation' }),
          });
          current = created.session;
        }
        setSessionId(current.id);
        const detail = await api<{ messages: Array<{ id: string; role: string; message: ChatMessage }> }>(`/api/sessions/${current.id}`);
        const restored = detail.messages.map((row) => {
          const msg: any = row.message || {};
          return {
            id: msg.id || row.id,
            role: msg.role === 'assistant' ? 'model' : msg.role,
            text: msg.text || '',
            timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            generatedWebsiteHtml: msg.generatedWebsiteHtml,
          } as ChatMessage;
        });
        setMessages(restored);
        const lastBuild = [...restored].reverse().find((m) => m.generatedWebsiteHtml);
        if (lastBuild?.generatedWebsiteHtml) setGeneratedHtml(lastBuild.generatedWebsiteHtml);
      } catch (error) {
        console.error('Failed to load account data:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [onUserUpdated]);

  // Auto-scroll chat when message added
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, activeTab]);

  // Quick suggestions from Screenshot 6
  const suggestions = [
    'Portfolio website with dark mode',
    'AI SaaS Landing page with pricing',
    'Modern restaurant website with menu',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setIsThinking(true);

    try {
      const data = await api<{ reply: string; generatedWebsiteHtml?: string; sessionId: string }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: [{ role: 'user', text }],
          modelTier: selectedModel.id,
          title: text,
        }),
      });

      setSessionId(data.sessionId);
      const modelReply: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        generatedWebsiteHtml: data.generatedWebsiteHtml,
      };
      setMessages((prev) => [...prev, modelReply]);

      if (data.generatedWebsiteHtml) {
        setGeneratedHtml(data.generatedWebsiteHtml);
        setActiveTab('build');
      }
      setCreditsRemaining((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error(err);
      const errorReply: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'model',
        text: `Request complete nahi ho saka: ${err?.message || 'server error'}. API keys aur Railway environment variables check karo.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick Demo Generator
  const handleGenerateInstantDemo = () => {
    handleSendMessage('Create a sleek AI Startup website with modern hero, features, and pricing');
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Top Navbar */}
      <TopNavbar
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenUserMenu={() => setIsUserMenuOpen(true)}
        onUpgradeClick={() => setIsSettingsOpen(true)}
        onPublishClick={() => setIsPublishModalOpen(true)}
        userInitial={userName?.charAt(0).toUpperCase() || 'P'}
        avatarUrl={userAvatar}
      />

      {/* Main Dynamic Body (Chat vs Build) */}
      <main className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto px-4 relative">
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col justify-between pt-2 pb-3 overflow-hidden">
            {/* Chat Conversation Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
              {messages.length === 0 ? (
                <div className="my-auto py-12 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-14 h-14 rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">What would you like to build?</h2>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Type your message or click a suggestion below to start building with RextFlex Ai.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                    >
                      {/* User Bubble */}
                      {isUser ? (
                        <div className="max-w-[85%] px-5 py-3 rounded-2xl bg-zinc-100/90 text-zinc-900 text-sm font-normal shadow-xs border border-zinc-200/60">
                          {m.text}
                        </div>
                      ) : (
                        /* Bot Bubble: Blue Dot + RextFlex Ai */
                        <div className="max-w-[95%] space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs"></span>
                            <span className="font-semibold text-xs text-zinc-900 tracking-tight">
                              RextFlex Ai
                            </span>
                            <span className="text-[10px] text-zinc-400">{m.timestamp}</span>
                          </div>
                          <div className="text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap pl-4">
                            {m.text}
                          </div>
                          {m.generatedWebsiteHtml && (
                            <div className="pl-4 pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveTab('build')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Live Build Dekhein</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Thinking Status Pill (Screenshot 1 & 7) */}
              {isThinking && (
                <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 animate-pulse">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
                    <span>RextFlex Ai</span>
                    <span className="text-blue-600 font-medium">is thinking...</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Controls Area */}
            <div className="pt-2 space-y-2">
              {/* 3 Rounded Suggestion Chips (Screenshot 3 & 6) */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(s)}
                    className="px-3.5 py-1.5 rounded-full bg-zinc-100/80 hover:bg-zinc-200/70 border border-zinc-200/70 text-zinc-700 text-xs font-medium whitespace-nowrap transition active:scale-95 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Prompt Input Box (Screenshot 1, 3, 6, 7) */}
              <div className="w-full rounded-3xl bg-white border border-zinc-200/90 shadow-sm p-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                {/* Text Area */}
                <textarea
                  id="rextflex-main-prompt-input"
                  rows={2}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask RextFlex Ai..."
                  className="w-full text-zinc-900 placeholder:text-zinc-400 text-sm resize-none focus:outline-none bg-transparent"
                />

                {/* Bottom Row Inside Box: + Button, Models Button, Mic, 3D Radial Blue Action Button */}
                <div className="flex items-center justify-between pt-2">
                  {/* Left: + Attachment Button */}
                  <div className="flex items-center gap-2">
                    <input id="rextflex-attachment-input" type="file" accept="image/*,.pdf,.txt,.md,.json,.csv" className="hidden" />
                    <button
                      id="btn-prompt-attach"
                      type="button"
                      onClick={() => document.getElementById('rextflex-attachment-input')?.click()}
                      className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200/80 active:scale-95 flex items-center justify-center text-zinc-600 transition cursor-pointer"
                      title="Add attachments or context"
                    >
                      <Plus className="w-4 h-4 stroke-[2]" />
                    </button>

                    {/* Model Switcher Button on Keyboard Bar as requested by user */}
                    <button
                      id="btn-model-selector-trigger"
                      type="button"
                      onClick={() => setIsModelSelectorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 text-blue-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
                      title="Change AI Engine Model"
                    >
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                      <span className="max-w-[110px] truncate">{selectedModel.name}</span>
                    </button>
                  </div>

                  {/* Right: Mic Voice Button & Radial Blue Glowing Button */}
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-voice-mic"
                      type="button"
                      onClick={() => {
                        setIsMicActive(!isMicActive);
                        if (!isMicActive) {
                          setInputPrompt('Build a high conversion landing page for my new product');
                        }
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                        isMicActive
                          ? 'bg-red-100 text-red-600 animate-pulse'
                          : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600'
                      }`}
                      title="Voice input"
                    >
                      <Mic className="w-4 h-4 stroke-[2]" />
                    </button>

                    {/* 3D Radial Blue Glowing Action Button (Screenshot 1, 3, 6, 7) */}
                    <button
                      id="btn-radial-blue-submit"
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={isThinking || !inputPrompt.trim()}
                      className={`w-10 h-10 rounded-full radial-blue-btn flex items-center justify-center text-white cursor-pointer ${
                        isThinking ? 'animate-pulse opacity-80' : ''
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title="Send to RextFlex Ai"
                    >
                      {isThinking ? (
                        <Radio className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Build Tab (Live Preview) */
          <WebsitePreview
            htmlCode={generatedHtml}
            onGoToChat={() => setActiveTab('chat')}
            onGenerateQuickDemo={handleGenerateInstantDemo}
            isGenerating={isThinking}
          />
        )}
      </main>

      {/* 4. Bottom Segmented Toggle Pill: Chat and Build */}
      <footer className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
        <div className="w-full bg-zinc-100/90 rounded-2xl p-1.5 flex items-center justify-between border border-zinc-200/70 shadow-xs">
          <button
            id="tab-btn-chat"
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 cursor-pointer text-center ${
              activeTab === 'chat'
                ? 'bg-white text-blue-600 border border-blue-300 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Chat
          </button>

          <button
            id="tab-btn-build"
            type="button"
            onClick={() => setActiveTab('build')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 cursor-pointer text-center ${
              activeTab === 'build'
                ? 'bg-white text-blue-600 border border-blue-300 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Build
          </button>
        </div>
      </footer>

      {/* 5. Modals & Overlays */}
      {/* Left Drawer */}
      <LeftDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeItem={activeTab === 'build' ? 'Build' : 'Chat'}
        onSelectItem={(item) => {
          if (item === 'Build') setActiveTab('build');
          else setActiveTab('chat');
        }}
        onUpgradeClick={() => setIsSettingsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        projectName={messages.length > 0 ? messages[0].text.slice(0, 20) : 'My Project'}
      />

      {/* User Menu Dropdown */}
      <UserMenuDropdown
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onUpgradeClick={() => setIsSettingsOpen(true)}
        onSignOut={onSignOut}
        userEmail={userEmail}
        userName={userName}
        avatarUrl={userAvatar}
        onUpdateAvatar={async (url) => {
          setUserAvatar(url);
          try {
            const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: url }),
            });
            onUserUpdated?.(result.user);
          } catch (error) {
            console.error('Avatar update failed:', error);
          }
        }}
        creditsRemaining={creditsRemaining}
      />

      {/* General Settings Modal */}
      <GeneralSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
        userName={userName}
        avatarUrl={userAvatar}
        onSaveName={async (name) => {
          setUserName(name);
          try {
            const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            });
            onUserUpdated?.(result.user);
          } catch (error) {
            console.error('Profile name update failed:', error);
          }
        }}
        onUpdateAvatar={async (url) => {
          setUserAvatar(url);
          try {
            const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: url }),
            });
            onUserUpdated?.(result.user);
          } catch (error) {
            console.error('Avatar update failed:', error);
          }
        }}
      />

      {/* AI Model Selector Modal (User Request) */}
      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModelId={selectedModel.id}
        onSelectModel={async (m) => {
          setSelectedModel(m);
          try {
            await api('/api/models', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ modelTier: m.id }),
            });
          } catch (error) {
            console.error('Model preference update failed:', error);
          }
        }}
      />

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsPublishModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Ready to Publish</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                Your RextFlex Ai website is built and ready for production hosting with SSL & custom domains.
              </p>
              <div className="p-3 bg-zinc-50 rounded-xl text-left text-xs space-y-1">
                <div className="text-zinc-500 font-medium">Public URL:</div>
                <div className="font-mono text-blue-600 font-bold break-all">
                  https://rextflex-ai.web.app/preview
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (generatedHtml) {
                      const url = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }
                    setIsPublishModalOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition"
                >
                  Publish Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
