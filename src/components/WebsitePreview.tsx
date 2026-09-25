import { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Smartphone, 
  Tablet, 
  Monitor, 
  RefreshCw, 
  Code2, 
  ExternalLink, 
  Sparkles,
  Copy,
  Check,
  ArrowLeft
} from 'lucide-react';

interface WebsitePreviewProps {
  htmlCode?: string;
  onGoToChat: () => void;
  onGenerateQuickDemo: () => void;
  isGenerating?: boolean;
}

export function WebsitePreview({
  htmlCode,
  onGoToChat,
  onGenerateQuickDemo,
  isGenerating = false,
}: WebsitePreviewProps) {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);

  // Set device mode based on initial screen width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) {
        setDeviceMode('mobile');
      } else {
        setDeviceMode('desktop');
      }
    }
  }, []);

  const handleCopyCode = async () => {
    if (!htmlCode) return;
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleRefreshIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  // If building right now and no HTML exists yet, show live building loader
  if (isGenerating && !htmlCode) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="w-full max-w-sm border border-blue-200/80 rounded-3xl p-10 flex flex-col items-center justify-center bg-white shadow-lg shadow-blue-500/5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-6 animate-pulse">
            <Sparkles className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">
            RextFlex Ai is building website...
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-xs leading-relaxed mb-6">
            Compiling modern layout, Tailwind CSS styles, components, and interactive scripts.
          </p>
          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full animate-[pulse_1s_infinite] w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // If no website has been created yet, render empty state
  if (!htmlCode) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Soft rounded container matching Screenshot 5 */}
        <div className="w-full max-w-sm border border-zinc-200/80 rounded-3xl p-10 flex flex-col items-center justify-center bg-white shadow-xs">
          {/* Blue icon with question mark matching Screenshot 5 */}
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-6">
            <HelpCircle className="w-8 h-8 stroke-[1.8]" />
          </div>

          <h3 className="text-lg font-bold text-zinc-900 mb-2">
            More context needed
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-xs leading-relaxed mb-6">
            Please provide more details in Chat to continue building your website
          </p>

          <div className="flex flex-col gap-2.5 w-full">
            <button
              type="button"
              onClick={onGoToChat}
              className="w-full py-2.5 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium text-xs tracking-tight shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              Ask RextFlex Ai in Chat
            </button>
            <button
              type="button"
              onClick={onGenerateQuickDemo}
              disabled={isGenerating}
              className="w-full py-2 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isGenerating ? 'Building preview...' : 'Generate Instant Demo Site'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live Interactive Preview
  return (
    <div className="w-full flex-1 flex flex-col bg-zinc-100/70 p-2 sm:p-4 overflow-hidden rounded-2xl">
      {/* Top Device & Code Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        {/* Left: Back to Chat + Live status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 shadow-xs transition cursor-pointer active:scale-95"
            title="Return to Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Build Ready</span>
          </div>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200 shadow-xs">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              deviceMode === 'desktop' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              deviceMode === 'tablet' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              deviceMode === 'mobile' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Code View & Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRefreshIframe}
            className="p-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 shadow-xs transition cursor-pointer"
            title="Refresh Preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              showCode ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 shadow-xs'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showCode ? 'Preview' : 'Code'}</span>
          </button>

          {showCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium flex items-center gap-1 shadow-xs transition cursor-pointer"
              title="Copy full HTML code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const blob = new Blob([htmlCode], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className="p-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 shadow-xs transition cursor-pointer"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        {showCode ? (
          <div className="w-full h-full bg-zinc-950 text-emerald-400 p-4 rounded-2xl overflow-auto font-mono text-xs shadow-inner border border-zinc-800">
            <pre className="whitespace-pre-wrap select-all">{htmlCode}</pre>
          </div>
        ) : (
          <div
            className={`h-full bg-white rounded-2xl shadow-lg border border-zinc-200/90 overflow-hidden transition-all duration-300 relative ${
              deviceMode === 'mobile'
                ? 'w-[375px] max-w-full'
                : deviceMode === 'tablet'
                ? 'w-[768px] max-w-full'
                : 'w-full'
            }`}
          >
            {isGenerating && (
              <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-xs flex items-center justify-center">
                <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-md flex items-center gap-2 text-xs font-semibold text-zinc-800">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>Updating website preview...</span>
                </div>
              </div>
            )}
            <iframe
              key={iframeKey}
              id="rextflex-live-website-frame"
              title="RextFlex Generated Website"
              srcDoc={htmlCode}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            />
          </div>
        )}
      </div>
    </div>
  );
}
