import { Menu } from 'lucide-react';

interface TopNavbarProps {
  onOpenDrawer: () => void;
  onOpenUserMenu: () => void;
  onUpgradeClick: () => void;
  onPublishClick: () => void;
  userInitial?: string;
  avatarUrl?: string;
}

export function TopNavbar({
  onOpenDrawer,
  onOpenUserMenu,
  onUpgradeClick,
  onPublishClick,
  userInitial = 'U',
  avatarUrl,
}: TopNavbarProps) {
  return (
    <header className="w-full bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-zinc-100 sticky top-0 z-30">
      {/* Left: Hamburger Menu Icon */}
      <button
        id="btn-open-sidebar-drawer"
        type="button"
        onClick={onOpenDrawer}
        className="w-10 h-10 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 active:scale-95 flex items-center justify-center text-zinc-800 transition shadow-sm cursor-pointer"
        aria-label="Open sidebar navigation"
      >
        <Menu className="w-5 h-5 stroke-[2.2]" />
      </button>

      {/* Right Group: Upgrade Plan (Slow 3D Flow & Glowing Light Ring) + Publish + Avatar */}
      <div className="flex items-center gap-3">
        {/* Upgrade Plan Button with Rotating Multicolor Glow Ring */}
        <div className="upgrade-glow-wrapper cursor-pointer" onClick={onUpgradeClick}>
          <div className="upgrade-glow-bg" />
          <div className="upgrade-glow-border" />
          <button
            id="btn-upgrade-plan-top"
            type="button"
            className="relative z-10 px-4 py-2 rounded-full bg-white hover:bg-zinc-50 text-zinc-900 font-medium text-xs sm:text-sm tracking-tight shadow-sm active:scale-98 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Upgrade Plan</span>
          </button>
        </div>

        {/* Publish Button */}
        <button
          id="btn-publish-site-top"
          type="button"
          onClick={onPublishClick}
          className="px-4 py-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 font-medium text-xs sm:text-sm transition active:scale-95 cursor-pointer"
        >
          Publish
        </button>

        {/* User Profile Avatar / DP */}
        <button
          id="btn-user-avatar-top"
          type="button"
          onClick={onOpenUserMenu}
          className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-base flex items-center justify-center shadow-md shadow-pink-500/20 transition cursor-pointer overflow-hidden border border-white"
          aria-label="Open user profile menu"
        >
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Profile DP" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <span>{userInitial}</span>
          )}
        </button>
      </div>
    </header>
  );
}
