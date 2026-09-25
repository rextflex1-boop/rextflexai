import { Settings, MessageSquare, BookOpen, LogOut, Sparkles, Camera } from 'lucide-react';

interface UserMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onUpgradeClick: () => void;
  onSignOut: () => void;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  onUpdateAvatar?: (url: string) => void;
  creditsRemaining?: number;
}

export function UserMenuDropdown({
  isOpen,
  onClose,
  onOpenSettings,
  onUpgradeClick,
  onSignOut,
  userEmail = '',
  userName = '',
  avatarUrl,
  onUpdateAvatar,
  creditsRemaining = 15,
}: UserMenuDropdownProps) {
  if (!isOpen) return null;

  const displayName = userName?.trim() ? userName : (userEmail.split('@')[0] || 'User');
  const userInitial = displayName.charAt(0).toUpperCase() || 'U';

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateAvatar) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/10" 
        onClick={onClose} 
      />

      {/* Dropdown Card */}
      <div 
        id="user-profile-dropdown"
        className="fixed top-16 right-4 w-80 sm:w-88 max-w-[92vw] bg-white rounded-3xl p-5 shadow-2xl border border-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* User Identity Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
          <div className="relative group shrink-0">
            <div className="w-12 h-12 rounded-full bg-pink-500 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-pink-500/20 overflow-hidden border border-white">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={displayName} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <span>{userInitial}</span>
              )}
            </div>
            {/* Change DP Camera Trigger */}
            <label 
              htmlFor="dropdown-dp-upload" 
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center cursor-pointer shadow hover:bg-black transition"
              title="Change Profile DP"
            >
              <Camera className="w-3 h-3" />
              <input 
                id="dropdown-dp-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarFileChange} 
              />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900 text-sm truncate">{displayName}</h3>
            <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
          </div>
        </div>

        {/* Credits Card (Screenshot 3) */}
        <div className="mt-4 p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/70">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-zinc-800">Credits</span>
            <span className="text-zinc-500">{creditsRemaining} left</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
              style={{ width: `${(creditsRemaining / 25) * 100}%` }}
            />
          </div>

          {/* Subtext */}
          <p className="text-[11px] text-zinc-600 leading-snug mb-3">
            ● You're on the free plan. Unlock additional features and credits by upgrading your plan.
          </p>

          {/* Upgrade Button */}
          <button
            id="btn-upgrade-in-credits-box"
            type="button"
            onClick={() => {
              onUpgradeClick();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-98 text-white font-medium text-xs tracking-wide shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade</span>
          </button>
        </div>

        {/* Menu Actions List */}
        <div className="mt-3 pt-1 space-y-1">
          <button
            id="btn-open-settings-modal"
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-700 hover:bg-zinc-100 transition cursor-pointer text-left"
          >
            <Settings className="w-4 h-4 text-zinc-500" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = 'mailto:support@rextflex.ai?subject=RextFlex%20Ai%20bug%20report';
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-700 hover:bg-zinc-100 transition cursor-pointer text-left"
          >
            <MessageSquare className="w-4 h-4 text-zinc-500" />
            <span>Report a bug</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.open('https://ai.google.dev/docs', '_blank');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-700 hover:bg-zinc-100 transition cursor-pointer text-left"
          >
            <BookOpen className="w-4 h-4 text-zinc-500" />
            <span>Documentation</span>
          </button>

          <button
            id="btn-signout"
            type="button"
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm text-red-600 hover:bg-red-50 transition cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}
