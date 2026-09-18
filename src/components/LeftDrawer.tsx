import { 
  X, 
  Home, 
  Globe, 
  Send, 
  Inbox, 
  FileText, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  Plus, 
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem?: string;
  onSelectItem: (item: string) => void;
  onUpgradeClick: () => void;
  onOpenSettings: () => void;
  projectName?: string;
}

export function LeftDrawer({
  isOpen,
  onClose,
  activeItem = 'Build',
  onSelectItem,
  onUpgradeClick,
  onOpenSettings,
  projectName = 'My Project',
}: LeftDrawerProps) {
  if (!isOpen) return null;

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
        {/* Top Header & Project Selector */}
        <div>
          {/* Brand Header & Close */}
          <div className="flex items-center justify-between pb-4">
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

          {/* Project Selector Box */}
          <div className="mt-2 mb-6 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between cursor-pointer hover:bg-zinc-100 transition">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center">
                {projectName.charAt(0).toUpperCase() || 'P'}
              </div>
              <span className="text-sm font-medium text-zinc-900 truncate">
                {projectName}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-1">
            {[
              { label: 'Chat', icon: Home },
              { label: 'Build', icon: Globe },
              { label: 'Domains', icon: Send },
              { label: 'Inbox', icon: Inbox },
              { label: 'Blogs', icon: FileText },
              { label: 'Analytics', icon: BarChart3 },
              { label: 'Site Settings', icon: Settings },
            ].map(({ label, icon: Icon }) => {
              const isActive = activeItem === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onSelectItem(label);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-medium transition cursor-pointer text-left ${
                    isActive
                      ? 'border-2 border-blue-400/80 bg-blue-50/70 text-blue-600 font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-zinc-500'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section (Screenshot 4) */}
        <div className="pt-6 mt-6 border-t border-zinc-100 space-y-4">
          {/* Unlock Premium Features Box with subtle glow */}
          <div className="relative rounded-3xl p-4 bg-gradient-to-br from-white to-zinc-50 border border-zinc-200 shadow-sm overflow-hidden">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br from-blue-400/20 via-pink-400/20 to-amber-300/20 rounded-full blur-xl" />
            <h4 className="text-sm font-bold text-zinc-900 mb-3 relative z-10">
              Unlock Premium Features
            </h4>
            <button
              id="btn-upgrade-now-drawer"
              type="button"
              onClick={() => {
                onUpgradeClick();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-medium text-sm shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer relative z-10"
            >
              <Sparkles className="w-4 h-4" />
              <span>Upgrade Now</span>
            </button>
          </div>

          {/* Quick links */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-600 hover:bg-zinc-100 transition cursor-pointer text-left"
            >
              <Settings className="w-4 h-4 text-zinc-500" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={() => alert('RextFlex Ai 24/7 Support: help@rextflex.ai')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-600 hover:bg-zinc-100 transition cursor-pointer text-left"
            >
              <HelpCircle className="w-4 h-4 text-zinc-500" />
              <span>Help</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectItem('Website');
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-800 font-medium hover:bg-zinc-100 transition cursor-pointer text-left"
            >
              <Plus className="w-4 h-4 text-zinc-700" />
              <span>Add new website</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
