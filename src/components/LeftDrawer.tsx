import React, { useState, useRef } from 'react';
import { 
  X, 
  Settings, 
  HelpCircle, 
  Plus, 
  ChevronDown,
  Sparkles,
  Check,
  Trash2,
  FolderOpen,
  MoreVertical,
  AlertTriangle
} from 'lucide-react';

export interface ProjectItem {
  id: string;
  title?: string;
  updated_at?: string;
  created_at?: string;
}

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem?: string;
  onSelectItem: (item: string) => void;
  onUpgradeClick: () => void;
  onOpenSettings: () => void;
  projectName?: string;
  projects?: ProjectItem[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onCreateNewProject?: () => void;
  onDeleteProject?: (projectId: string) => void;
}

function formatProjectDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function LeftDrawer({
  isOpen,
  onClose,
  activeItem = 'Build',
  onSelectItem,
  onUpgradeClick,
  onOpenSettings,
  projectName = 'My Project',
  projects = [],
  activeProjectId,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject,
}: LeftDrawerProps) {
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [holdingProjectId, setHoldingProjectId] = useState<string | null>(null);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didTriggerHoldRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  if (!isOpen) return null;

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const displayTitle = currentProject?.title || projectName || 'Projects';
  const displayInitial = displayTitle.trim().charAt(0).toUpperCase() || 'P';

  const startHold = (proj: ProjectItem, clientX?: number, clientY?: number) => {
    didTriggerHoldRef.current = false;
    setHoldingProjectId(proj.id);
    if (clientX !== undefined && clientY !== undefined) {
      touchStartPosRef.current = { x: clientX, y: clientY };
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(() => {
      didTriggerHoldRef.current = true;
      setHoldingProjectId(null);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      setProjectToDelete(proj);
    }, 450); // 450ms hold time
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldingProjectId(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 12 || dy > 12) {
        cancelHold();
      }
    }
  };

  const handleProjectClick = (proj: ProjectItem) => {
    if (didTriggerHoldRef.current) {
      didTriggerHoldRef.current = false;
      return;
    }
    onSelectProject?.(proj.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/35 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Drawer Panel */}
      <aside 
        id="sidebar-drawer-panel"
        className="relative w-72 sm:w-80 max-w-[85vw] h-full bg-white flex flex-col justify-between p-5 shadow-2xl z-10 overflow-y-auto transition-transform duration-300 ease-out"
      >
        {/* Top Header & Projects Section */}
        <div className="space-y-4">
          {/* Brand Header & Close */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-zinc-950">
                RextFlex <span className="text-blue-600">Ai</span>
              </span>
            </div>
            <button
              id="btn-close-drawer"
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 active:scale-95 flex items-center justify-center text-zinc-600 transition cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Projects Selector & Accordion (User Request) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                Projects
              </span>
              <button
                type="button"
                id="btn-drawer-new-project"
                onClick={() => {
                  onCreateNewProject?.();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 active:scale-95 transition cursor-pointer"
                title="Start a new project / chat"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New</span>
              </button>
            </div>

            {/* Clickable Projects Selector Box (shown in screenshot) */}
            <button
              id="btn-projects-dropdown-toggle"
              type="button"
              onClick={() => setIsProjectsOpen((prev) => !prev)}
              className="w-full p-2.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100/90 active:scale-[0.99] border border-zinc-200/80 flex items-center justify-between cursor-pointer transition text-left shadow-xs group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {displayInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {displayTitle}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {projects.length} {projects.length === 1 ? 'project / chat' : 'projects / chats'}
                  </p>
                </div>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 group-hover:text-zinc-600 ${
                  isProjectsOpen ? 'rotate-180 text-blue-600' : ''
                }`} 
              />
            </button>

            {/* Expandable Project List with All User Chats */}
            {isProjectsOpen && (
              <div className="mt-2 p-1.5 bg-zinc-50/70 rounded-2xl border border-zinc-200/70 space-y-1">
                {/* Start New Project Button */}
                <button
                  type="button"
                  onClick={() => {
                    onCreateNewProject?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white hover:bg-blue-50/60 border border-dashed border-zinc-300 hover:border-blue-300 text-xs font-semibold text-blue-600 transition cursor-pointer shadow-xs"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>+ Start New Project</span>
                </button>

                {/* List of user chats / projects */}
                <div className="max-h-60 overflow-y-auto space-y-1 pt-1 pr-0.5">
                  {projects.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-400">
                      No projects yet. Click above to create one.
                    </div>
                  ) : (
                    projects.map((proj) => {
                      const isActive = activeProjectId === proj.id;
                      const isHolding = holdingProjectId === proj.id;
                      const title = proj.title || 'Untitled Project';
                      const initial = title.trim().charAt(0).toUpperCase() || 'P';

                      return (
                        <div
                          key={proj.id}
                          onTouchStart={(e) => startHold(proj, e.touches[0]?.clientX, e.touches[0]?.clientY)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={cancelHold}
                          onTouchCancel={cancelHold}
                          onMouseDown={() => startHold(proj)}
                          onMouseUp={cancelHold}
                          onMouseLeave={cancelHold}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setProjectToDelete(proj);
                          }}
                          onClick={() => handleProjectClick(proj)}
                          className={`group select-none w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition duration-150 cursor-pointer ${
                            isHolding
                              ? 'scale-[0.97] ring-2 ring-red-400 bg-red-50'
                              : isActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                            <div
                              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                isActive
                                  ? 'bg-white/25 text-white'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-zinc-900'}`}>
                                {title}
                              </p>
                              {proj.updated_at && (
                                <p className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-zinc-400'}`}>
                                  {formatProjectDate(proj.updated_at)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-white mr-0.5 pointer-events-none" />
                            )}
                            {onDeleteProject && (
                              <button
                                type="button"
                                title="Hold or tap to delete project"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(proj);
                                }}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  isActive
                                    ? 'text-white/80 hover:bg-blue-700 hover:text-white'
                                    : 'text-zinc-400 hover:bg-red-50 hover:text-red-600'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* User Hint for Hold to Delete */}
                {projects.length > 0 && (
                  <div className="px-2 pt-1.5 text-[10px] text-zinc-400 flex items-center gap-1 select-none">
                    <span>💡 Project par <strong>hold (press karke)</strong> rakhein delete karne ke liye.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal / Action Sheet */}
        {projectToDelete && (
          <div 
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => {
              e.stopPropagation();
              setProjectToDelete(null);
            }}
          >
            <div 
              className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-zinc-900">Delete Project?</h4>
                  <p className="text-xs text-zinc-500 truncate">{projectToDelete.title || 'Untitled Project'}</p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Kya aap is project ko delete karna chahte hain? Is project ki chats aur generated website permanently delete ho jayegi.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  id="btn-confirm-delete-project"
                  onClick={() => {
                    if (projectToDelete) {
                      onDeleteProject?.(projectToDelete.id);
                      setProjectToDelete(null);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Project</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  className="w-full py-2 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Section */}
        <div className="pt-6 mt-6 border-t border-zinc-100 space-y-4">
          {/* Unlock Premium Features Box */}
          <div className="relative rounded-3xl p-4 bg-gradient-to-br from-white to-zinc-50 border border-zinc-200 shadow-sm overflow-hidden">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br from-blue-400/20 via-pink-400/20 to-amber-300/20 rounded-full blur-xl" />
            <h4 className="text-sm font-bold text-zinc-900 mb-3 relative z-10">
              Unlock Premium Features
            </h4>
            <button
              id="btn-upgrade-now-drawer"
              type="button"
              onClick={() => {
                onClose();
                onUpgradeClick();
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold tracking-tight shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition cursor-pointer relative z-10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upgrade Now</span>
            </button>
          </div>

          {/* Bottom Settings Link */}
          <button
            id="btn-settings-drawer"
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 active:scale-98 transition text-xs font-medium cursor-pointer"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
