import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Check, Download, Image as ImageIcon, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { api } from '../lib/api';

function ModelViewer({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const existing = document.querySelector('script[data-model-viewer="rextflex"]');
    if (existing) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    script.dataset.modelViewer = 'rextflex';
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    mountRef.current.replaceChildren();
    const viewer = document.createElement('model-viewer');
    viewer.setAttribute('src', src);
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('auto-rotate', '');
    viewer.setAttribute('shadow-intensity', '1');
    viewer.setAttribute('environment-image', 'neutral');
    viewer.setAttribute('ar', '');
    Object.assign(viewer.style, { width: '100%', height: '100%', background: 'linear-gradient(135deg,#10131a,#1d2533)', borderRadius: '20px' });
    mountRef.current.appendChild(viewer);
  }, [src]);

  return <div ref={mountRef} className="w-full h-[300px]" />;
}

type TaskKind = 'image-to-3d' | 'text-to-3d-preview' | 'text-to-3d-refine';

interface ThreeDStudioProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onImported?: () => void;
}

export function ThreeDStudio({ isOpen, onClose, sessionId, onImported }: ThreeDStudioProps) {
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [imageData, setImageData] = useState('');
  const [imageName, setImageName] = useState('');
  const [prompt, setPrompt] = useState('A premium futuristic robot mascot, polished white armor, subtle blue glowing details, game-ready 3D asset');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [taskId, setTaskId] = useState('');
  const [taskKind, setTaskKind] = useState<TaskKind>('image-to-3d');
  const [modelUrl, setModelUrl] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setBusy(false); setStatus(''); setTaskId(''); setTaskKind('image-to-3d'); setModelUrl(''); setError(''); setImporting(false);
  };

  const accept = useMemo(() => mode === 'image' ? 'image/png,image/jpeg' : undefined, [mode]);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  async function readImage(file: File) {
    setError(''); setModelUrl(''); setImageName(file.name);
    const value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image.'));
      reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
      reader.readAsDataURL(file);
    });
    setImageData(value);
  }

  async function createModel() {
    setBusy(true); setError(''); setModelUrl(''); setStatus(mode === 'image' ? 'Uploading image to the 3D engine…' : 'Generating 3D preview mesh…');
    try {
      const created = mode === 'image'
        ? await api<{ taskId: string; type: TaskKind }>('/api/3d/image-to-3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: imageData }) })
        : await api<{ taskId: string; type: TaskKind }>('/api/3d/text-to-3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      setTaskId(created.taskId); setTaskKind(created.type);
      await poll(created.taskId, created.type);
    } catch (e: any) {
      setBusy(false); setError(e?.message || '3D generation failed.');
    }
  }

  async function poll(id: string, kind: TaskKind) {
    let currentKind = kind;
    for (let i = 0; i < 90; i += 1) {
      const data = await api<{ task: any }>(`/api/3d/task?id=${encodeURIComponent(id)}&type=${encodeURIComponent(currentKind)}`);
      const task = data.task || {};
      const state = String(task.status || task.state || '').toUpperCase();
      const label = state || 'PROCESSING';
      setStatus(currentKind === 'text-to-3d-preview' ? `Generating 3D mesh… ${label}` : currentKind === 'text-to-3d-refine' ? `Applying textures… ${label}` : `Generating 3D model… ${label}`);
      if (state === 'SUCCEEDED' || state === 'SUCCESS') {
        const glb = task?.model_urls?.glb || task?.model_urls?.['glb'];
        if (currentKind === 'text-to-3d-preview' && glb && !task?.texture_urls) {
          const refined = await api<{ taskId: string; type: TaskKind }>('/api/3d/text-to-3d/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewTaskId: id }) });
          currentKind = refined.type;
          setTaskId(refined.taskId); setTaskKind(refined.type);
          setStatus('Preview ready. Refining texture…');
          id = refined.taskId;
          continue;
        }
        if (glb) setModelUrl(glb);
        setBusy(false);
        setStatus('3D model ready ✓');
        return;
      }
      if (state === 'FAILED' || state === 'CANCELED' || state === 'CANCELLED') throw new Error(task?.error || '3D generation failed.');
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('3D generation timed out.');
  }

  async function importToProject() {
    if (!sessionId || !modelUrl) return;
    setImporting(true); setError('');
    try {
      await api('/api/3d/import-to-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, modelUrl, path: `models/${(mode === 'image' ? imageName.replace(/\.[^.]+$/, '') : 'generated-model').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 50) || 'generated-model'}.glb` }) });
      onImported?.();
      setStatus('Imported into project ✓');
    } catch (e: any) {
      setError(e?.message || 'Could not import model into the project.');
    } finally {
      setImporting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close 3D Studio" />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[28px] bg-white shadow-2xl border border-zinc-200">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center"><Box className="w-5 h-5" /></div><div><h2 className="font-bold">RextFlex 3D Studio</h2><p className="text-xs text-zinc-500">Image → 3D and Text → 3D</p></div></div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 grid lg:grid-cols-[1fr_1.2fr] gap-5">
          <section className="space-y-4">
            <div className="flex gap-2 p-1 rounded-2xl bg-zinc-100">
              <button onClick={() => { reset(); setMode('image'); }} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold ${mode === 'image' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}><ImageIcon className="w-4 h-4 inline mr-1" />Image → 3D</button>
              <button onClick={() => { reset(); setMode('text'); }} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold ${mode === 'text' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}><Sparkles className="w-4 h-4 inline mr-1" />Text → 3D</button>
            </div>

            {mode === 'image' ? <label className="block rounded-3xl border-2 border-dashed border-zinc-200 p-6 text-center hover:border-blue-300 cursor-pointer">
              <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readImage(f); e.currentTarget.value = ''; }} />
              <Upload className="w-8 h-8 mx-auto text-zinc-400" />
              <div className="mt-3 font-semibold">Upload a product, character or object image</div>
              <div className="mt-1 text-xs text-zinc-500">PNG/JPEG • one clear image works best</div>
              {imageName && <div className="mt-3 text-xs text-blue-600 font-medium">{imageName}</div>}
            </label> : <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500">Describe the 3D object</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} className="w-full rounded-2xl border border-zinc-200 p-4 text-sm outline-none focus:border-blue-400" placeholder="Describe the object, material, shape and style…" />
            </div>}

            <button disabled={busy || (mode === 'image' ? !imageData : !prompt.trim())} onClick={() => void createModel()} className="w-full px-4 py-3 rounded-2xl bg-zinc-950 text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />} {busy ? 'Generating…' : 'Generate 3D Model'}
            </button>
            {taskId && <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600">Task: <span className="font-mono">{taskId}</span></div>}
            {status && <div className="flex items-center gap-2 text-sm text-zinc-700"><Check className="w-4 h-4 text-emerald-600" />{status}</div>}
            {error && <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
          </section>

          <section className="space-y-3">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-2 min-h-[320px] flex items-center justify-center overflow-hidden">
              {modelUrl ? <ModelViewer src={modelUrl} /> : <div className="text-center text-zinc-500 p-10"><Box className="w-12 h-12 mx-auto mb-3 opacity-50" /><div className="font-semibold text-zinc-300">3D preview</div><div className="text-xs mt-1">Your generated GLB will appear here.</div></div>}
            </div>
            {modelUrl && <div className="flex flex-col sm:flex-row gap-2"><a href={modelUrl} target="_blank" rel="noreferrer" className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-800 font-semibold text-sm text-center"><Download className="w-4 h-4 inline mr-1" />Download GLB</a><button onClick={() => void importToProject()} disabled={importing || !sessionId} className="flex-1 px-4 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40">{importing ? 'Importing…' : 'Use in Project'}</button></div>}
          </section>
        </div>
      </div>
    </div>
  );
}
