import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import {
  Bot,
  Check,
  ChevronDown,
  Cpu,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Globe2,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ChatMessage, AIModel } from '../types';
import { TopNavbar } from './TopNavbar';
import { LeftDrawer } from './LeftDrawer';
import { UserMenuDropdown } from './UserMenuDropdown';
import { GeneralSettingsModal } from './GeneralSettingsModal';
import { ModelSelectorModal, AVAILABLE_MODELS } from './ModelSelectorModal';
import { WebsitePreview } from './WebsitePreview';
import { ThreeDStudio } from './ThreeDStudio';
import { api } from '../lib/api';

function formatTimestamp(ts?: string | Date) {
  if (!ts) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseSessionMessages(rawRows: any[]): ChatMessage[] {
  return (rawRows || []).map((row) => {
    const raw = typeof row.message === 'object' && row.message !== null
      ? row.message
      : (() => { try { return JSON.parse(row.message); } catch { return { text: String(row.message || '') }; } })();
    const text = typeof raw.text === 'string' ? raw.text : typeof raw.content === 'string' ? raw.content : '';
    return {
      id: raw.id || row.id,
      role: row.role === 'assistant' || raw.role === 'assistant' || raw.role === 'model' ? 'model' : 'user',
      text: text.replace(/^\s*```(?:html|xml|css|js|json)?\s*/i, '').replace(/```\s*$/g, '').trim(),
      timestamp: formatTimestamp(raw.timestamp || row.created_at),
      generatedWebsiteHtml: raw.generatedWebsiteHtml,
    } as ChatMessage;
  }).filter((m) => m.text || m.generatedWebsiteHtml);
}

type WorkspaceMode = 'chat' | 'files' | 'research' | 'preview';
type FileItem = { path: string; mime?: string; size: number; updated_at?: string };
type AgentEvent = { type: string; path?: string; size?: number; command?: string; code?: number; status?: string };
type SearchResult = { title: string; url: string; snippet: string };
type AgentProgress = { label: string; done: boolean };

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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('chat');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [is3DStudioOpen, setIs3DStudioOpen] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS.find((m) => m.id === 'titan') || AVAILABLE_MODELS[0]);
  const [userName, setUserName] = useState(initialUserName);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(initialAvatarUrl);
  const [creditsRemaining] = useState(15);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<Array<{ id: string; title?: string; updated_at?: string; created_at?: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | undefined>();
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState('');
  const [uploading, setUploading] = useState(false);

  const [researchQuery, setResearchQuery] = useState('');
  const [deepResearch, setDeepResearch] = useState(true);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchResults, setResearchResults] = useState<SearchResult[]>([]);
  const [researchSummary, setResearchSummary] = useState('');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentProjectTitle = useMemo(() => sessionsList.find((s) => s.id === sessionId)?.title || 'RextFlex Workspace', [sessionsList, sessionId]);

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
        const sessions = await api<{ sessions: Array<{ id: string; title?: string; updated_at?: string; created_at?: string }> }>('/api/sessions');
        if (cancelled) return;
        setSessionsList(sessions.sessions || []);
        let current = sessions.sessions?.[0];
        if (!current) {
          current = (await api<{ session: { id: string; title: string } }>('/api/sessions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Project' }),
          })).session;
          setSessionsList([current]);
        }
        setSessionId(current.id);
        await loadSession(current.id);
      } catch (error) {
        console.error('Failed to load workspace', error);
      }
    })();
    return () => { cancelled = true; };
  }, [onUserUpdated]);

  async function loadSession(targetId: string) {
    const detail = await api<{ messages: any[] }>(`/api/sessions/${targetId}`);
    const restored = parseSessionMessages(detail.messages);
    setMessages(restored);
    const lastBuild = [...restored].reverse().find((m) => m.generatedWebsiteHtml);
    setGeneratedHtml(lastBuild?.generatedWebsiteHtml);
    await refreshFiles(targetId);
  }

  async function refreshFiles(targetId = sessionId) {
    if (!targetId) return;
    const data = await api<{ files: FileItem[] }>(`/api/workspace/files?sessionId=${encodeURIComponent(targetId)}`);
    setFiles(data.files || []);
    if (selectedFile && !(data.files || []).some((f) => f.path === selectedFile)) {
      setSelectedFile('');
      setFileContent('');
    }
  }

  async function selectProject(targetId: string) {
    setSessionId(targetId);
    setAgentProgress([]);
    await loadSession(targetId);
  }

  async function createProject() {
    const created = await api<{ session: { id: string; title: string } }>('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Project' }),
    });
    setSessionsList((prev) => [created.session, ...prev]);
    setSessionId(created.session.id);
    setMessages([]);
    setGeneratedHtml(undefined);
    setFiles([]);
    setSelectedFile('');
    setFileContent('');
    setWorkspaceMode('chat');
  }

  async function deleteProject(targetId: string) {
    await api(`/api/sessions/${targetId}`, { method: 'DELETE' });
    const remaining = sessionsList.filter((s) => s.id !== targetId);
    setSessionsList(remaining);
    if (targetId === sessionId) {
      if (remaining[0]) await selectProject(remaining[0].id);
      else await createProject();
    }
  }

  async function sendChat(textValue?: string) {
    const text = (textValue || inputPrompt).trim();
    if (!text || isThinking || agentBusy || !sessionId) return;
    if (agentEnabled) return runAgent(text);
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text, timestamp: formatTimestamp() };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsThinking(true);
    try {
      const data = await api<{ reply: string; generatedWebsiteHtml?: string; sessionId: string }>('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: [{ role: 'user', text }], modelTier: selectedModel.id, title: text }),
      });
      const botMsg: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: data.reply, timestamp: formatTimestamp(), generatedWebsiteHtml: data.generatedWebsiteHtml };
      setMessages((prev) => [...prev, botMsg]);
      if (data.generatedWebsiteHtml) setGeneratedHtml(data.generatedWebsiteHtml);
      setSessionsList((prev) => prev.map((s) => s.id === data.sessionId ? { ...s, title: s.title === 'New Project' || s.title === 'New conversation' ? text.slice(0, 40) : s.title, updated_at: new Date().toISOString() } : s));
    } catch (error: any) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'model', text: error?.message || 'AI request failed.', timestamp: formatTimestamp() }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function runAgent(text?: string) {
    const prompt = (text || inputPrompt).trim();
    if (!sessionId || !prompt || agentBusy) return;
    setInputPrompt('');
    setAgentBusy(true);
    setAgentProgress([
      { label: 'Planning request', done: false },
      { label: 'Preparing E2B sandbox', done: false },
      { label: 'Creating project files', done: false },
      { label: 'Running build checks', done: false },
      { label: 'Finalizing project', done: false },
    ]);
    setMessages((prev) => [...prev, { id: `user-agent-${Date.now()}`, role: 'user', text: prompt, timestamp: formatTimestamp() }]);
    try {
      const result = await api<{ message: string; events: AgentEvent[]; previewHtml?: string; execution?: string }>('/api/agent/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt, modelTier: 'apex' }),
      });
      const progress = [...(result.events || [])];
      const fileProgress = progress.filter((e) => e.type === 'write_file' && e.path).map((e) => ({ label: `Creating ${e.path}`, done: e.status !== 'failed' }));
      const runProgress = progress.filter((e) => e.type === 'run_command').map((e) => ({ label: e.code === 0 ? `Build check ✓` : `Build check failed`, done: e.code === 0 }));
      const completed = [
        { label: 'Planning request', done: true },
        { label: result.execution === 'e2b' ? 'E2B sandbox ready' : 'Workspace ready', done: true },
        ...(fileProgress.length ? fileProgress : [{ label: 'Creating project files', done: true }]),
        ...(runProgress.length ? runProgress : [{ label: 'Background build checks', done: true }]),
        { label: 'Finalizing project', done: true },
      ];
      setAgentProgress(completed);
      setMessages((prev) => [...prev, { id: `model-agent-${Date.now()}`, role: 'model', text: result.message, timestamp: formatTimestamp(), generatedWebsiteHtml: result.previewHtml }]);
      if (result.previewHtml) setGeneratedHtml(result.previewHtml);
      await refreshFiles(sessionId);
    } catch (error: any) {
      setAgentProgress((prev) => prev.map((item) => item.label === 'Finalizing project' ? { ...item, done: false } : item));
      setMessages((prev) => [...prev, { id: `agent-error-${Date.now()}`, role: 'model', text: error?.message || 'Agent failed.', timestamp: formatTimestamp() }]);
    } finally {
      setAgentBusy(false);
    }
  }

  async function openFile(file: FileItem) {
    setSelectedFile(file.path);
    setFileAnalysis('');
    try {
      const data = await api<{ path: string; text: string }>(`/api/workspace/file?sessionId=${encodeURIComponent(sessionId || '')}&path=${encodeURIComponent(file.path)}`);
      setFileContent(data.text || '');
    } catch (error: any) {
      setFileContent(`Unable to open file: ${error?.message || 'Unknown error'}`);
    }
  }

  async function saveFile() {
    if (!sessionId || !selectedFile) return;
    setFileSaving(true);
    try {
      await api('/api/workspace/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, path: selectedFile, content: fileContent, mime: 'text/plain' }) });
      await refreshFiles(sessionId);
    } finally {
      setFileSaving(false);
    }
  }

  async function analyzeFile() {
    if (!sessionId || !selectedFile) return;
    setFileAnalysis('Analyzing file with RextFlex Ai…');
    try {
      const data = await api<{ analysis: string }>('/api/workspace/analyze-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, path: selectedFile, question: 'Explain this file, summarize it, find issues, and suggest concrete improvements.' }) });
      setFileAnalysis(data.analysis);
    } catch (error: any) {
      setFileAnalysis(error?.message || 'File analysis failed.');
    }
  }

  async function uploadFile(file: File) {
    if (!sessionId) return;
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',').pop() || '') : reject(new Error('Could not read file.'));
        reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      await api('/api/workspace/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, name: file.name, mime: file.type || 'application/octet-stream', dataBase64 }) });
      await refreshFiles(sessionId);
      setWorkspaceMode('files');
      setIsPlusOpen(false);
    } catch (error: any) {
      alert(error?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(path: string) {
    if (!sessionId) return;
    await api('/api/workspace/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, path }) });
    if (selectedFile === path) { setSelectedFile(''); setFileContent(''); }
    await refreshFiles(sessionId);
  }

  async function runResearch() {
    if (!researchQuery.trim() || researchBusy) return;
    setResearchBusy(true); setResearchResults([]); setResearchSummary('');
    try {
      const data = await api<{ results: SearchResult[]; summary?: string }>('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: researchQuery, deepResearch }) });
      setResearchResults(data.results || []);
      setResearchSummary(data.summary || '');
    } catch (error: any) {
      setResearchSummary(error?.message || 'Research failed.');
    } finally {
      setResearchBusy(false);
    }
  }

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking, agentBusy, agentProgress, workspaceMode]);

  const suggestions = ['Build a premium React website', 'Create a SaaS dashboard with pricing', 'Analyze my uploaded project and fix issues'];
  const userInitial = userName?.charAt(0).toUpperCase() || userEmail?.charAt(0).toUpperCase() || 'R';

  return (
    <div className="min-h-screen h-screen bg-[#f7f8fb] text-zinc-900 flex flex-col overflow-hidden">
      <TopNavbar onOpenDrawer={() => setIsDrawerOpen(true)} onOpenUserMenu={() => setIsUserMenuOpen(true)} onUpgradeClick={() => setIsSettingsOpen(true)} onPublishClick={() => setIsPublishModalOpen(true)} userInitial={userInitial} avatarUrl={userAvatar} />

      <div className="flex-1 min-h-0 flex flex-col max-w-6xl w-full mx-auto px-3 sm:px-5 pb-3">
        <div className="pt-3 pb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3"><div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div><div className="min-w-0"><h1 className="font-bold tracking-tight truncate">{currentProjectTitle}</h1><p className="text-[11px] text-zinc-500">{agentEnabled ? 'Apex Agent • E2B execution' : `RextFlex Ai • ${selectedModel.name}`}</p></div></div>
          <div className="flex items-center gap-2">{agentEnabled ? <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold"><Cpu className="w-3.5 h-3.5" />Apex</div> : <button onClick={() => setIsModelSelectorOpen(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700"><Cpu className="w-3.5 h-3.5" />{selectedModel.name}<ChevronDown className="w-3 h-3" /></button>}<span className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] ${agentEnabled ? 'text-blue-600' : 'text-emerald-600'}`}><span className={`w-2 h-2 rounded-full ${agentEnabled ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />{agentEnabled ? 'Agent mode' : 'Ready'}</span></div>
        </div>

        <main className="flex-1 min-h-0 mt-1 rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden relative">
          {workspaceMode === 'chat' && <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 && <div className="h-full flex items-center justify-center text-center"><div className="max-w-lg space-y-3"><div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25"><Sparkles className="w-7 h-7" /></div><h2 className="text-2xl font-bold">Build anything with RextFlex Ai</h2><p className="text-sm text-zinc-500">Normal chat for ideas. Turn on <b>Agent</b> for Apex + E2B to create real React projects, files and builds in the background.</p></div></div>}
              {messages.map((m) => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] ${m.role === 'user' ? 'bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-3' : 'px-2 py-1'}`}><div className={`text-[10px] mb-1 ${m.role === 'user' ? 'text-zinc-400' : 'text-zinc-400'}`}>{m.role === 'user' ? 'You' : 'RextFlex Ai'} • {m.timestamp}</div>{m.role === 'user' ? <p className="text-sm whitespace-pre-wrap">{m.text}</p> : <div className="prose prose-sm max-w-none text-zinc-800"><Markdown>{m.text}</Markdown></div>}{m.generatedWebsiteHtml && <button type="button" onClick={() => { setGeneratedHtml(m.generatedWebsiteHtml); setWorkspaceMode('preview'); }} className="mt-3 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">Open Live Preview</button>}</div></div>)}
              {isThinking && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin text-blue-600" /> RextFlex Ai is thinking…</div>}
              {agentBusy && <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 space-y-2 max-w-md"><div className="text-xs font-semibold text-blue-700">Apex is building in the background</div>{agentProgress.map((item) => <div key={item.label} className="flex items-center gap-2 text-xs text-zinc-700">{item.done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}{item.label}{item.done ? ' ✓' : '…'}</div>)}</div>}
              {!agentBusy && agentProgress.length > 0 && <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-2 max-w-md"><div className="text-xs font-semibold text-zinc-700">Build activity</div>{agentProgress.map((item) => <div key={item.label} className="flex items-center gap-2 text-xs text-zinc-600"><Check className="w-3.5 h-3.5 text-emerald-600" />{item.label} ✓</div>)}</div>}
              <div ref={chatBottomRef} />
            </div>

            <div className="border-t border-zinc-200/80 p-3 relative">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">{suggestions.map((s) => <button key={s} onClick={() => void sendChat(s)} className="shrink-0 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700">{s}</button>)}</div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }} rows={2} placeholder={agentEnabled ? 'Tell Apex what to build…' : 'Ask RextFlex Ai…'} className="w-full bg-transparent resize-none text-sm focus:outline-none px-2 py-1" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsPlusOpen((v) => !v)} className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-700 flex items-center justify-center hover:bg-zinc-100" title="Add"><Plus className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setAgentEnabled((v) => !v)} className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold border ${agentEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-700 border-zinc-200'}`} title="Toggle Apex Agent"><Bot className="w-3.5 h-3.5" />{agentEnabled ? 'Agent ON' : 'Agent OFF'}</button>
                  </div>
                  <button type="button" onClick={() => void sendChat()} disabled={!inputPrompt.trim() || isThinking || agentBusy} className="w-10 h-10 rounded-full radial-blue-btn text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
                </div>
              </div>

              {isPlusOpen && <div className="absolute left-3 bottom-[120px] z-30 w-72 rounded-2xl border border-zinc-200 bg-white shadow-2xl p-2">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-400">Create & attach</div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 text-left"><Upload className="w-4 h-4 text-blue-600" /><div><div className="text-sm font-semibold">Upload File</div><div className="text-[11px] text-zinc-500">Image, PDF, ZIP, code or document</div></div></button>
                <button onClick={() => { setIs3DStudioOpen(true); setIsPlusOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 text-left"><span className="text-lg">🧊</span><div><div className="text-sm font-semibold">Image / Text → 3D</div><div className="text-[11px] text-zinc-500">Generate a GLB model</div></div></button>
                <button onClick={() => { setWorkspaceMode('files'); setIsPlusOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 text-left"><FolderOpen className="w-4 h-4 text-zinc-700" /><div><div className="text-sm font-semibold">Project Files</div><div className="text-[11px] text-zinc-500">Open files without leaving the workspace</div></div></button>
                <button onClick={() => { setWorkspaceMode('research'); setIsPlusOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 text-left"><Globe2 className="w-4 h-4 text-emerald-600" /><div><div className="text-sm font-semibold">Web Search / Deep Research</div><div className="text-[11px] text-zinc-500">Search and summarize current sources</div></div></button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.currentTarget.value = ''; }} />
              </div>}
            </div>
          </div>}

          {workspaceMode === 'files' && <div className="h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200"><div><div className="font-semibold text-sm">Project Files</div><div className="text-[11px] text-zinc-500">Files created by Apex and your uploads</div></div><button onClick={() => setWorkspaceMode('chat')} className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
            <div className="flex-1 min-h-0 flex flex-col md:flex-row"><aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 p-3 overflow-y-auto"><div className="flex items-center justify-between mb-2"><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Files</span><button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center"><Upload className="w-4 h-4" /></button><input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.currentTarget.value = ''; }} /></div><div className="space-y-1">{files.length === 0 && <div className="text-xs text-zinc-400 py-8 text-center">No project files yet.</div>}{files.map((file) => <button key={file.path} onClick={() => void openFile(file)} className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 ${selectedFile === file.path ? 'bg-blue-600 text-white' : 'hover:bg-zinc-50 text-zinc-700'}`}><FileCode2 className="w-4 h-4" /><span className="truncate text-xs">{file.path}</span></button>)}</div></aside><section className="flex-1 min-h-0 flex flex-col p-3 gap-3"><div className="flex items-center justify-between gap-2"><div className="text-xs text-zinc-500 truncate">{selectedFile || 'Select a file'}</div><div className="flex gap-2">{selectedFile && <button onClick={() => void analyzeFile()} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold">Analyze</button>}{selectedFile && <button onClick={() => void saveFile()} disabled={fileSaving} className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold">{fileSaving ? 'Saving…' : 'Save'}</button>}</div></div><textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} disabled={!selectedFile} spellCheck={false} className="flex-1 min-h-[260px] rounded-2xl bg-zinc-950 text-zinc-100 p-4 font-mono text-xs outline-none resize-none" placeholder="Select a text/code file…" />{fileAnalysis && <div className="max-h-48 overflow-auto rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm"><div className="font-bold mb-2">AI Analysis</div><Markdown>{fileAnalysis}</Markdown></div>}</section></div>
          </div>}

          {workspaceMode === 'research' && <div className="h-full overflow-y-auto p-4 sm:p-6"><div className="max-w-4xl mx-auto space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-bold text-lg">Web Search & Deep Research</h2><p className="text-xs text-zinc-500">Current public web results with source links.</p></div><button onClick={() => setWorkspaceMode('chat')} className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center"><X className="w-4 h-4" /></button></div><div className="flex gap-2"><input value={researchQuery} onChange={(e) => setResearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runResearch(); }} className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 outline-none text-sm" placeholder="Search the web…" /><button onClick={() => void runResearch()} disabled={researchBusy} className="px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold"><Search className="w-4 h-4 inline mr-1" />{researchBusy ? 'Searching…' : 'Search'}</button></div><label className="inline-flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" checked={deepResearch} onChange={(e) => setDeepResearch(e.target.checked)} /> Deep Research summary</label>{researchSummary && <div className="rounded-2xl border border-zinc-200 p-4"><div className="font-semibold text-sm mb-2">Research Brief</div><Markdown>{researchSummary}</Markdown></div>}<div className="grid md:grid-cols-2 gap-3">{researchResults.map((r, i) => <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-zinc-200 p-4 hover:border-blue-300"><div className="text-[10px] font-bold text-blue-600">SOURCE {i + 1}</div><div className="font-semibold text-sm mt-1">{r.title}</div><div className="text-xs text-zinc-500 mt-2">{r.snippet}</div><div className="text-[10px] text-zinc-400 mt-3 truncate">{r.url}</div></a>)}</div></div></div>}

          {workspaceMode === 'preview' && <WebsitePreview htmlCode={generatedHtml} onGoToChat={() => setWorkspaceMode('chat')} onGenerateQuickDemo={() => void sendChat('Build a premium demo website with a modern hero, feature cards and pricing section.')} isGenerating={isThinking || agentBusy} />}
        </main>
      </div>

      <LeftDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} activeItem={workspaceMode === 'preview' ? 'Build' : 'Chat'} onSelectItem={(item) => setWorkspaceMode(item === 'Build' ? 'preview' : 'chat')} onUpgradeClick={() => setIsSettingsOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} projectName={currentProjectTitle} projects={sessionsList} activeProjectId={sessionId} onSelectProject={(id) => void selectProject(id)} onCreateNewProject={() => void createProject()} onDeleteProject={(id) => void deleteProject(id)} />

      <UserMenuDropdown isOpen={isUserMenuOpen} onClose={() => setIsUserMenuOpen(false)} onOpenSettings={() => setIsSettingsOpen(true)} onUpgradeClick={() => setIsSettingsOpen(true)} onSignOut={onSignOut} userEmail={userEmail} userName={userName} avatarUrl={userAvatar} onUpdateAvatar={async (url) => { setUserAvatar(url); const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) }); onUserUpdated?.(result.user); }} creditsRemaining={creditsRemaining} />

      <GeneralSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userEmail={userEmail} userName={userName} avatarUrl={userAvatar} onSaveName={async (name) => { setUserName(name); const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); onUserUpdated?.(result.user); }} onUpdateAvatar={async (url) => { setUserAvatar(url); const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) }); onUserUpdated?.(result.user); }} />

      <ModelSelectorModal isOpen={isModelSelectorOpen} onClose={() => setIsModelSelectorOpen(false)} selectedModelId={selectedModel.id} onSelectModel={async (m) => { setSelectedModel(m); await api('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelTier: m.id }) }).catch(console.error); }} />

      <ThreeDStudio isOpen={is3DStudioOpen} onClose={() => setIs3DStudioOpen(false)} sessionId={sessionId} onImported={() => void refreshFiles(sessionId || undefined)} />

      {isPublishModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/40" onClick={() => setIsPublishModalOpen(false)} /><div className="relative bg-white rounded-3xl p-6 w-full max-w-md z-10 shadow-2xl"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold">Publish</h3><p className="text-xs text-zinc-500">Export or preview the generated build.</p></div><button onClick={() => setIsPublishModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"><X className="w-4 h-4" /></button></div><div className="rounded-2xl bg-zinc-50 p-4 text-xs text-zinc-600">Use Live Preview to inspect your generated website. Cloud publishing remains a separate deployment step.</div><button className="mt-4 w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold" onClick={() => { setWorkspaceMode('preview'); setIsPublishModalOpen(false); }}>Open Live Preview</button></div></div>}
    </div>
  );
}
