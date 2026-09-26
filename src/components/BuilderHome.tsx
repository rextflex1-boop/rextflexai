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
  Hammer,
  Loader2,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Terminal,
  Trash2,
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

type WorkspaceMode = 'chat' | 'agent' | 'files' | 'terminal' | 'research' | 'preview';

type FileItem = { path: string; mime?: string; size: number; updated_at?: string };
type AgentEvent = { type: string; path?: string; size?: number; command?: string; code?: number; stdout?: string; stderr?: string };
type SearchResult = { title: string; url: string; snippet: string };

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

  const [agentPrompt, setAgentPrompt] = useState('Build a premium modern landing page for my AI product with responsive mobile design.');
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [agentMessage, setAgentMessage] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState('');
  const [uploading, setUploading] = useState(false);

  const [terminalInput, setTerminalInput] = useState('npm run build');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [terminalBusy, setTerminalBusy] = useState(false);

  const [researchQuery, setResearchQuery] = useState('Latest trends in AI website builders');
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
    setAgentEvents([]);
    setAgentMessage('');
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
    if (!text || isThinking || !sessionId) return;
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

  async function runAgent() {
    if (!sessionId || !agentPrompt.trim() || agentBusy) return;
    setAgentBusy(true);
    setAgentEvents([]);
    setAgentMessage('Agent is planning your project…');
    try {
      const result = await api<{ message: string; events: AgentEvent[]; previewHtml?: string }>('/api/agent/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt: agentPrompt, modelTier: selectedModel.id }),
      });
      setAgentMessage(result.message);
      setAgentEvents(result.events || []);
      if (result.previewHtml) setGeneratedHtml(result.previewHtml);
      await refreshFiles(sessionId);
      setWorkspaceMode(result.previewHtml ? 'preview' : 'files');
    } catch (error: any) {
      setAgentMessage(error?.message || 'Agent failed.');
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
      await api('/api/workspace/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, path: selectedFile, content: fileContent, mime: 'text/plain' }),
      });
      await refreshFiles(sessionId);
    } finally {
      setFileSaving(false);
    }
  }

  async function analyzeFile() {
    if (!sessionId || !selectedFile) return;
    setFileAnalysis('Analyzing file with RextFlex Ai…');
    try {
      const data = await api<{ analysis: string }>('/api/workspace/analyze-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, path: selectedFile, question: 'Explain this file, summarize it, find issues, and suggest concrete improvements.' }),
      });
      setFileAnalysis(data.analysis);
    } catch (error: any) {
      setFileAnalysis(error?.message || 'File analysis failed.');
    }
  }

  async function uploadFile(file: File) {
    if (!sessionId) return;
    setUploading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',').pop() || '') : reject(new Error('Could not read file.'));
        reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      await api('/api/workspace/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: file.name, mime: file.type || 'application/octet-stream', dataBase64: data }),
      });
      await refreshFiles(sessionId);
      setWorkspaceMode('files');
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

  async function runTerminalCommand(command = terminalInput) {
    if (!sessionId || !command.trim() || terminalBusy) return;
    setTerminalBusy(true);
    setTerminalLines((prev) => [...prev, `$ ${command}`]);
    try {
      const result = await api<{ stdout: string; stderr: string; code: number }>('/api/workspace/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, command }),
      });
      if (result.stdout) setTerminalLines((prev) => [...prev, result.stdout.trimEnd()]);
      if (result.stderr) setTerminalLines((prev) => [...prev, result.stderr.trimEnd()]);
      setTerminalLines((prev) => [...prev, `Process exited with code ${result.code}`]);
      await refreshFiles(sessionId);
    } catch (error: any) {
      setTerminalLines((prev) => [...prev, `ERROR: ${error?.message || 'Command failed'}`]);
    } finally {
      setTerminalBusy(false);
    }
  }

  async function runResearch() {
    if (!researchQuery.trim() || researchBusy) return;
    setResearchBusy(true);
    setResearchResults([]);
    setResearchSummary('');
    try {
      const data = await api<{ results: SearchResult[]; summary?: string }>('/api/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: researchQuery, deepResearch }),
      });
      setResearchResults(data.results || []);
      setResearchSummary(data.summary || '');
    } catch (error: any) {
      setResearchSummary(error?.message || 'Research failed.');
    } finally {
      setResearchBusy(false);
    }
  }

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking, workspaceMode]);

  const suggestions = ['Build a premium 3D AI website', 'Create a SaaS dashboard with pricing', 'Analyze my uploaded project and fix issues'];
  const modes: Array<{ id: WorkspaceMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'chat', label: 'Chat', icon: Sparkles },
    { id: 'agent', label: 'Agent', icon: Bot },
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'research', label: 'Research', icon: Globe2 },
    { id: 'preview', label: 'Preview', icon: ExternalLink },
  ];

  const userInitial = userName?.charAt(0).toUpperCase() || userEmail?.charAt(0).toUpperCase() || 'R';

  return (
    <div className="min-h-screen h-screen bg-[#f7f8fb] text-zinc-900 flex flex-col overflow-hidden">
      <TopNavbar
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenUserMenu={() => setIsUserMenuOpen(true)}
        onUpgradeClick={() => setIsSettingsOpen(true)}
        onPublishClick={() => setIsPublishModalOpen(true)}
        userInitial={userInitial}
        avatarUrl={userAvatar}
      />

      <div className="flex-1 min-h-0 flex flex-col max-w-6xl w-full mx-auto px-3 sm:px-5 pb-3">
        <div className="pt-3 pb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20"><Sparkles className="w-4 h-4" /></div>
              <div className="min-w-0"><h1 className="font-bold tracking-tight truncate">{currentProjectTitle}</h1><p className="text-[11px] text-zinc-500">AI Workspace • {selectedModel.name}</p></div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live workspace</div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-1.5 flex gap-1 overflow-x-auto no-scrollbar">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return <button key={mode.id} type="button" onClick={() => setWorkspaceMode(mode.id)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${workspaceMode === mode.id ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100'}`}><Icon className="w-3.5 h-3.5" />{mode.label}</button>;
          })}
          <button type="button" onClick={() => setIsModelSelectorOpen(true)} className="ml-auto shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"><Cpu className="w-3.5 h-3.5" />{selectedModel.name}<ChevronDown className="w-3 h-3" /></button>
        </div>

        <main className="flex-1 min-h-0 mt-3 rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          {workspaceMode === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 && <div className="h-full flex items-center justify-center text-center"><div className="max-w-md space-y-3"><div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25"><Sparkles className="w-7 h-7" /></div><h2 className="text-2xl font-bold">Build anything with RextFlex Ai</h2><p className="text-sm text-zinc-500">Chat normally, switch to Agent when you want the AI to create real files, use Terminal to run safe project commands, Research to browse the web, and Files to upload/analyze your project.</p></div></div>}
                {messages.map((m) => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] ${m.role === 'user' ? 'bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-3' : 'px-2 py-1'}`}><div className="text-[10px] text-zinc-400 mb-1">{m.role === 'user' ? 'You' : 'RextFlex Ai'} • {m.timestamp}</div>{m.role === 'user' ? <p className="text-sm whitespace-pre-wrap">{m.text}</p> : <div className="prose prose-sm max-w-none text-zinc-800"><Markdown>{m.text}</Markdown></div>}{m.generatedWebsiteHtml && <button type="button" onClick={() => { setGeneratedHtml(m.generatedWebsiteHtml); setWorkspaceMode('preview'); }} className="mt-3 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">Open Live Preview</button>}</div></div>)}
                {isThinking && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin text-blue-600" /> RextFlex Ai is thinking…</div>}
                <div ref={chatBottomRef} />
              </div>
              <div className="border-t border-zinc-200/80 p-3">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">{suggestions.map((s) => <button key={s} onClick={() => void sendChat(s)} className="shrink-0 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 cursor-pointer">{s}</button>)}</div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }} rows={2} placeholder="Ask RextFlex Ai…" className="w-full bg-transparent resize-none text-sm focus:outline-none px-2 py-1" /><div className="flex items-center justify-between"><button type="button" onClick={() => setWorkspaceMode('agent')} className="text-xs font-semibold text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"><Bot className="w-3.5 h-3.5 inline mr-1" />Build with Agent</button><button type="button" onClick={() => void sendChat()} disabled={!inputPrompt.trim() || isThinking} className="w-10 h-10 rounded-full radial-blue-btn text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"><Send className="w-4 h-4" /></button></div></div>
              </div>
            </div>
          )}

          {workspaceMode === 'agent' && (
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950 text-white p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">RextFlex Agent</p><h2 className="text-2xl font-bold mt-1">Tell the agent what to build.</h2><p className="text-sm text-zinc-300 mt-2 max-w-2xl">It plans the task, writes real project files, can run safe build commands, and hands the result to Live Preview.</p></div><div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Bot className="w-6 h-6" /></div></div><textarea value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} rows={4} className="mt-5 w-full rounded-2xl bg-white/10 border border-white/15 p-4 text-sm outline-none focus:border-blue-400" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void runAgent()} disabled={agentBusy || !agentPrompt.trim()} className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"><Hammer className="w-4 h-4" />{agentBusy ? 'Agent running…' : 'Run Agent'}</button><button type="button" onClick={() => setAgentPrompt('Analyze the current project, identify bugs, fix them, and run the build.')} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm cursor-pointer">Fix current project</button></div></div>
                {agentMessage && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-zinc-800"><div className="font-semibold mb-1">Agent report</div><div className="whitespace-pre-wrap">{agentMessage}</div></div>}
                <div className="grid sm:grid-cols-2 gap-3">{['Analyze → plan', 'Create / edit files', 'Run build checks', 'Open live preview'].map((x) => <div key={x} className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center"><Check className="w-4 h-4 text-emerald-600" /></div><span className="text-sm font-medium">{x}</span></div>)}</div>
                {agentEvents.length > 0 && <div className="rounded-2xl border border-zinc-200 overflow-hidden"><div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-bold">Agent execution log</div><div className="divide-y">{agentEvents.map((event, i) => <div key={i} className="p-3 text-xs"><div className="font-semibold text-zinc-800">{event.type}{event.path ? ` • ${event.path}` : ''}{event.command ? ` • ${event.command}` : ''}</div>{event.stdout && <pre className="mt-1 whitespace-pre-wrap font-mono text-zinc-600 max-h-40 overflow-auto">{event.stdout}</pre>}{event.stderr && <pre className="mt-1 whitespace-pre-wrap font-mono text-red-600 max-h-40 overflow-auto">{event.stderr}</pre>}</div>)}</div></div>}
              </div>
            </div>
          )}

          {workspaceMode === 'files' && (
            <div className="h-full flex flex-col sm:flex-row min-h-0">
              <aside className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-zinc-200 bg-zinc-50/70 p-3 flex flex-col min-h-0"><div className="flex items-center justify-between mb-2"><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Project Files</span><button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 cursor-pointer" title="Upload file"><Upload className="w-4 h-4" /></button><input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.currentTarget.value = ''; }} /></div><div className="text-[11px] text-zinc-500 mb-2">{files.length} files • upload, edit, analyze</div><div className="flex-1 overflow-y-auto space-y-1">{files.length === 0 && <div className="text-xs text-zinc-400 py-8 text-center">Agent-created files appear here.</div>}{files.map((file) => <button type="button" key={file.path} onClick={() => void openFile(file)} className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 ${selectedFile === file.path ? 'bg-blue-600 text-white' : 'hover:bg-white text-zinc-700'}`}><FileCode2 className="w-4 h-4 shrink-0" /><span className="truncate text-xs">{file.path}</span></button>)}</div></aside>
              <section className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 gap-3"><div className="flex items-center justify-between gap-2"><div className="text-xs text-zinc-500 truncate">{selectedFile || 'Select a file'} </div><div className="flex items-center gap-2">{selectedFile && <button type="button" onClick={() => void analyzeFile()} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer"><Sparkles className="w-3.5 h-3.5 inline mr-1" />Analyze</button>}{selectedFile && <button type="button" onClick={() => void deleteFile(selectedFile)} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button>}{selectedFile && <button type="button" disabled={fileSaving} onClick={() => void saveFile()} className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold cursor-pointer">{fileSaving ? 'Saving…' : 'Save'}</button>}</div></div><textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} disabled={!selectedFile} spellCheck={false} className="flex-1 min-h-[320px] rounded-2xl bg-zinc-950 text-zinc-100 p-4 font-mono text-xs outline-none resize-none" placeholder="Select a text/code file to edit…" />{fileAnalysis && <div className="max-h-56 overflow-auto rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm"><div className="font-bold text-zinc-900 mb-2">AI Analysis</div><div className="prose prose-sm max-w-none"><Markdown>{fileAnalysis}</Markdown></div></div>}</section>
            </div>
          )}

          {workspaceMode === 'terminal' && (
            <div className="h-full flex flex-col bg-zinc-950 text-zinc-100"><div className="px-4 py-3 border-b border-white/10 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Terminal className="w-4 h-4 text-emerald-400" /> RextFlex Project Terminal</div><button type="button" onClick={() => setTerminalLines([])} className="text-xs text-zinc-400 hover:text-white cursor-pointer">Clear</button></div><div className="flex-1 overflow-y-auto p-4 font-mono text-xs whitespace-pre-wrap">{terminalLines.length ? terminalLines.join('\n\n') : 'Terminal is ready. Safe commands are enabled for this project workspace.'}</div><div className="p-3 border-t border-white/10"><div className="flex flex-wrap gap-2 pb-2"><button onClick={() => setTerminalInput('pwd')} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-[11px] cursor-pointer">pwd</button><button onClick={() => setTerminalInput('find . -maxdepth 2 -type f')} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-[11px] cursor-pointer">list files</button><button onClick={() => setTerminalInput('npm run build')} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-[11px] cursor-pointer">build</button><button onClick={() => setTerminalInput('npm install --ignore-scripts')} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-[11px] cursor-pointer">install</button></div><div className="flex items-center gap-2"><span className="text-emerald-400 font-mono">$</span><input value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runTerminalCommand(); }} className="flex-1 bg-transparent outline-none font-mono text-xs" placeholder="Enter an allowed command" /><button type="button" onClick={() => void runTerminalCommand()} disabled={terminalBusy} className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center cursor-pointer disabled:opacity-40">{terminalBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button></div></div></div>
          )}

          {workspaceMode === 'research' && (
            <div className="h-full overflow-y-auto p-4 sm:p-6"><div className="max-w-5xl mx-auto space-y-4"><div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-blue-50 p-5"><div className="flex items-center gap-2 mb-3"><Globe2 className="w-5 h-5 text-blue-600" /><div><h2 className="font-bold">Web Search & Deep Research</h2><p className="text-xs text-zinc-500">Search current public web results and turn them into a cited research brief.</p></div></div><div className="flex flex-col sm:flex-row gap-2"><input value={researchQuery} onChange={(e) => setResearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runResearch(); }} className="flex-1 px-4 py-3 rounded-2xl bg-white border border-zinc-200 outline-none text-sm" placeholder="Search the web…" /><button onClick={() => void runResearch()} disabled={researchBusy} className="px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"><Search className="w-4 h-4 inline mr-1" />{researchBusy ? 'Researching…' : 'Search'}</button></div><label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer"><input type="checkbox" checked={deepResearch} onChange={(e) => setDeepResearch(e.target.checked)} /> Deep Research summary with citations</label></div>{researchSummary && <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="font-bold text-sm mb-2">Research Brief</div><div className="prose prose-sm max-w-none"><Markdown>{researchSummary}</Markdown></div></div>}<div className="grid md:grid-cols-2 gap-3">{researchResults.map((r, i) => <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-zinc-200 p-4 hover:border-blue-300 hover:bg-blue-50/30 transition"><div className="text-[10px] font-bold text-blue-600">SOURCE {i + 1}</div><div className="font-semibold text-sm mt-1 line-clamp-2">{r.title}</div><div className="text-xs text-zinc-500 mt-2 line-clamp-3">{r.snippet}</div><div className="text-[10px] text-zinc-400 mt-3 truncate">{r.url}</div></a>)}</div>{!researchResults.length && !researchBusy && <div className="text-center py-16 text-sm text-zinc-400">Search the web to populate sources.</div>}</div></div>
          )}

          {workspaceMode === 'preview' && <WebsitePreview htmlCode={generatedHtml} onGoToChat={() => setWorkspaceMode('chat')} onGenerateQuickDemo={() => void sendChat('Build a premium demo website with a modern hero, feature cards and pricing section.')} isGenerating={isThinking} />}
        </main>
      </div>

      <LeftDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeItem={workspaceMode === 'preview' ? 'Build' : 'Chat'}
        onSelectItem={(item) => setWorkspaceMode(item === 'Build' ? 'preview' : 'chat')}
        onUpgradeClick={() => setIsSettingsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        projectName={currentProjectTitle}
        projects={sessionsList}
        activeProjectId={sessionId}
        onSelectProject={(id) => void selectProject(id)}
        onCreateNewProject={() => void createProject()}
        onDeleteProject={(id) => void deleteProject(id)}
      />

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
          const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) });
          onUserUpdated?.(result.user);
        }}
        creditsRemaining={creditsRemaining}
      />

      <GeneralSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
        userName={userName}
        avatarUrl={userAvatar}
        onSaveName={async (name) => {
          setUserName(name);
          const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
          onUserUpdated?.(result.user);
        }}
        onUpdateAvatar={async (url) => {
          setUserAvatar(url);
          const result = await api<{ user: { id: string; email: string; name: string; image?: string | null } }>('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) });
          onUserUpdated?.(result.user);
        }}
      />

      <ModelSelectorModal isOpen={isModelSelectorOpen} onClose={() => setIsModelSelectorOpen(false)} selectedModelId={selectedModel.id} onSelectModel={async (m) => { setSelectedModel(m); await api('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelTier: m.id }) }).catch(console.error); }} />

      {isPublishModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/40" onClick={() => setIsPublishModalOpen(false)} /><div className="relative bg-white rounded-3xl p-6 w-full max-w-md z-10 shadow-2xl"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold">Publish</h3><p className="text-xs text-zinc-500">Export or preview the generated build.</p></div><button onClick={() => setIsPublishModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button></div><div className="rounded-2xl bg-zinc-50 p-4 text-xs text-zinc-600">For now, “Publish” opens the generated HTML locally. A real cloud deploy connector can be added in the next phase.</div><button className="mt-4 w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold cursor-pointer" onClick={() => { if (generatedHtml) { const url = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' })); window.open(url, '_blank', 'noopener,noreferrer'); } setIsPublishModalOpen(false); }}>Open Build</button></div></div>}
    </div>
  );
}
