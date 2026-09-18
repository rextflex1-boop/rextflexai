import { X, Cpu, Check, Zap } from 'lucide-react';
import { AIModel } from '../types';

// These IDs intentionally match the real backend model tiers.
export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'silicon',
    name: 'Silicon',
    provider: 'Groq • gpt-oss-20b',
    badge: 'Fast',
    description: 'Fast and efficient for everyday chat, quick website ideas and code generation.',
    speed: 'Ultra Fast',
  },
  {
    id: 'titan',
    name: 'Titan',
    provider: 'Groq • gpt-oss-120b',
    badge: 'Default',
    description: 'Powerful core model for architecture, reasoning and premium website generation.',
    speed: 'Balanced',
  },
  {
    id: 'apex',
    name: 'Apex',
    provider: 'Pollinations • qwen-coder',
    badge: 'Coding',
    description: 'Coding-focused model for larger development tasks and harder engineering prompts.',
    speed: 'Deep',
  },
];

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: AIModel) => void;
}

export function ModelSelectorModal({ isOpen, onClose, selectedModelId, onSelectModel }: ModelSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-xs" onClick={onClose} />
      <div id="model-selector-modal" className="relative w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-100 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><Cpu className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm">Select AI Model</h3>
              <p className="text-[11px] text-zinc-500">Choose your RextFlex Ai engine</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 active:scale-95 flex items-center justify-center text-zinc-600 transition cursor-pointer"><X className="w-4 h-4 stroke-[2.2]" /></button>
        </div>

        <div className="mt-4 space-y-2">
          {AVAILABLE_MODELS.map((m) => {
            const isSelected = m.id === selectedModelId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelectModel(m); onClose(); }}
                className={`w-full p-3.5 rounded-2xl border text-left transition flex items-start justify-between cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/70 shadow-xs' : 'border-zinc-200/80 hover:bg-zinc-50'}`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 text-sm">{m.name}</span>
                    {m.badge && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{m.badge}</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{m.provider} • {m.speed}</div>
                  <p className="text-xs text-zinc-600 mt-1 leading-snug">{m.description}</p>
                </div>
                <div className="pt-1">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs"><Check className="w-3.5 h-3.5 stroke-[3]" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-400"><Zap className="w-3 h-3" /></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
