import { useState } from 'react';
import { HelpCircle, Smartphone, Tablet, Monitor, RefreshCw, Code2, ExternalLink, Sparkles } from 'lucide-react';

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
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');
  const [showCode, setShowCode] = useState(false);

  // If no website has been created yet, render EXACTLY Screenshot 5!
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
            Please provide more details to continue building your website
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
    <div className="w-full flex-1 flex flex-col bg-zinc-100/70 p-3 sm:p-5 overflow-hidden">
      {/* Top Device & Code Bar */}
      <div className="flex items-center justify-between mb-3 px-2">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200 shadow-xs">
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              deviceMode === 'mobile' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              deviceMode === 'tablet' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              deviceMode === 'desktop' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>

        {/* Code View & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              showCode ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white text-zinc-700 border-zinc-200 shadow-xs'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showCode ? 'Hide Code' : 'View Code'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const newWindow = window.open();
              if (newWindow) {
                newWindow.document.write(htmlCode);
                newWindow.document.close();
              }
            }}
            className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 shadow-xs transition"
            title="Open in new window"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        {showCode ? (
          <div className="w-full h-full bg-zinc-900 text-emerald-400 p-4 rounded-2xl overflow-auto font-mono text-xs shadow-inner">
            <pre className="whitespace-pre-wrap">{htmlCode}</pre>
          </div>
        ) : (
          <div
            className={`h-full bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden transition-all duration-300 ${
              deviceMode === 'mobile'
                ? 'w-[375px] max-w-full'
                : deviceMode === 'tablet'
                ? 'w-[768px] max-w-full'
                : 'w-full'
            }`}
          >
            <iframe
              id="rextflex-live-website-frame"
              title="RextFlex Generated Website"
              srcDoc={htmlCode}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
