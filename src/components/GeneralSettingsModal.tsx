import { useState } from 'react';
import { X, User, Globe, Send, FileText, Check, Shield, Camera } from 'lucide-react';

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  onSaveName?: (newName: string) => void;
  onUpdateAvatar?: (newUrl: string) => void;
}

export function GeneralSettingsModal({
  isOpen,
  onClose,
  userEmail = '',
  userName = '',
  avatarUrl,
  onSaveName,
  onUpdateAvatar,
}: GeneralSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'Account' | 'Domains' | 'Plans and Billings' | 'Invoices'>('Account');
  const [customName, setCustomName] = useState(userName);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onSaveName) onSaveName(customName);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

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

  const userInitial = customName?.charAt(0).toUpperCase() || (userEmail.charAt(0).toUpperCase() || 'U');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        id="general-settings-modal"
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-100 z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
      >
        {/* Header User Profile & Close */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-3.5">
            <div className="relative group shrink-0">
              <div className="w-13 h-13 rounded-full bg-pink-500 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-pink-500/20 overflow-hidden border border-white">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={customName} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              <label 
                htmlFor="settings-dp-upload"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center cursor-pointer shadow hover:bg-black transition"
                title="Change Avatar DP"
              >
                <Camera className="w-3 h-3" />
                <input 
                  id="settings-dp-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarFileChange} 
                />
              </label>
            </div>
            <div>
              <input
                id="input-user-display-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter your name"
                className="font-semibold text-zinc-900 text-base focus:outline-none focus:border-b-2 focus:border-blue-500 bg-transparent"
              />
              <p className="text-xs text-zinc-500">{userEmail}</p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 active:scale-95 flex items-center justify-center text-zinc-600 transition cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Section Heading */}
        <div className="pt-5">
          <h4 className="text-xs font-semibold text-zinc-700 tracking-wide uppercase mb-3">
            General Settings
          </h4>

          {/* Navigation Pill List (Screenshot 2) */}
          <div className="space-y-1.5">
            {[
              { label: 'Account', icon: User },
              { label: 'Domains', icon: Globe },
              { label: 'Plans and Billings', icon: Send },
              { label: 'Invoices', icon: FileText },
            ].map(({ label, icon: Icon }) => {
              const isActive = activeTab === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTab(label as typeof activeTab)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition cursor-pointer text-left ${
                    isActive
                      ? 'border-2 border-blue-400/80 bg-blue-50/60 text-blue-600 font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-zinc-500'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Detail Content based on Tab */}
        <div className="mt-5 pt-4 border-t border-zinc-100 text-xs text-zinc-600">
          {activeTab === 'Account' && (
            <div className="space-y-3">
              <div className="p-3 bg-zinc-50 rounded-xl">
                <span className="font-semibold text-zinc-800">Linked Provider:</span> Google Authentication (Firebase/OAuth)
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-800">Role & Security</div>
                  <div className="text-[11px] text-zinc-500">Full Workspace Owner</div>
                </div>
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaved ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                <span>{isSaved ? 'Saved Successfully' : 'Save Changes'}</span>
              </button>
            </div>
          )}

          {activeTab === 'Domains' && (
            <div className="p-4 bg-zinc-50 rounded-xl space-y-2">
              <p className="font-medium text-zinc-800">Custom Domains</p>
              <p className="text-[11px] text-zinc-500">Connect your custom domain (e.g. www.mysite.com) to your RextFlex Ai project.</p>
              <div className="pt-2">
                <input 
                  type="text" 
                  placeholder="yourdomain.com" 
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'Plans and Billings' && (
            <div className="p-4 bg-zinc-50 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-900 text-sm">Free Starter Plan</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Active</span>
              </div>
              <p className="text-[11px] text-zinc-500">15 AI Generation credits included. Upgrade to Pro for unlimited generation & custom code exports.</p>
            </div>
          )}

          {activeTab === 'Invoices' && (
            <div className="p-4 bg-zinc-50 rounded-xl text-center">
              <p className="text-zinc-500">No invoices yet. Your account is on the Free tier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
