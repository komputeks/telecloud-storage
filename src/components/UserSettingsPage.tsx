'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/lib/themes/ThemeProvider';
import { 
  Settings, Bot, MessageSquare, Save, Loader2, Check, AlertCircle, 
  Eye, EyeOff, HelpCircle, User, HardDrive, Sun, Moon, Monitor
} from 'lucide-react';

interface UserSettings {
  name: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

export function UserSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'telegram' | 'storage' | 'appearance'>('profile');
  const [hasGlobalBot, setHasGlobalBot] = useState(false);
  
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
      checkGlobalBot();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          name: user?.name || '',
          telegram_bot_token: data.settings?.telegram_bot_token || '',
          telegram_chat_id: data.settings?.telegram_chat_id || '',
        });
      }
    } catch {
      console.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const checkGlobalBot = async () => {
    try {
      const res = await fetch('/api/telegram/check');
      if (res.ok) {
        const data = await res.json();
        setHasGlobalBot(data.hasGlobalBot === true);
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaved(true);
      await refreshUser();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testTelegramConnection = async () => {
    if (!settings.telegram_bot_token) {
      setError('Please enter a bot token first');
      return;
    }

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: settings.telegram_bot_token,
          chat_id: settings.telegram_chat_id,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ Connection successful!\n\nBot: @${data.bot_username}\nChat: ${data.chat_title || data.chat_id}`);
      } else {
        alert(`❌ Connection failed: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Connection failed: ${err}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasBotConfigured = !!(settings.telegram_bot_token && settings.telegram_chat_id);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">Account Settings</h1>
              <p className="text-xs text-[var(--muted)]">Manage your profile and Telegram integration</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'telegram', label: 'Telegram Bot', icon: Bot },
            { id: 'storage', label: 'Storage', icon: HardDrive },
            { id: 'appearance', label: 'Appearance', icon: Sun },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-[var(--secondary)] text-[var(--muted)] hover:bg-[var(--border)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Profile Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Display Name</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-[var(--secondary)]/50 border border-[var(--border)] rounded-xl text-[var(--muted)] cursor-not-allowed"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Telegram Bot Tab */}
        {activeTab === 'telegram' && (
          <div className="space-y-6">
            {/* Setup Guide */}
            <div className="bg-gradient-to-r from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-[#6366f1]/30">
                  <HelpCircle className="w-6 h-6 text-[#6366f1]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Bot API Setup</h3>
                  <p className="text-sm text-[var(--muted)] mb-3">
                    Set up your own Telegram bot for private file storage. Files up to 50MB per upload (larger files are automatically split into chunks).
                  </p>
                  <ol className="text-sm text-[var(--foreground)] space-y-2">
                    <li><span className="text-[#6366f1] font-semibold">1.</span> Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" className="text-[#22d3ee] hover:underline">@BotFather</a></li>
                    <li><span className="text-[#6366f1] font-semibold">2.</span> Send <code className="bg-[var(--secondary)] px-2 py-0.5 rounded">/newbot</code> and follow instructions</li>
                    <li><span className="text-[#6366f1] font-semibold">3.</span> Copy the bot token</li>
                    <li><span className="text-[#6366f1] font-semibold">4.</span> Create channel/group, add bot as admin</li>
                    <li><span className="text-[#6366f1] font-semibold">5.</span> Get Chat ID from <a href="https://t.me/userinfobot" target="_blank" className="text-[#22d3ee] hover:underline">@userinfobot</a></li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Bot Credentials</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Bot Token</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={settings.telegram_bot_token}
                      onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                      className="w-full px-4 py-3 pr-12 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors font-mono text-sm"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">Get this from @BotFather on Telegram</p>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegram_chat_id}
                    onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors"
                    placeholder="-1001234567890"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Channel or group ID where files will be stored</p>
                </div>

                <button
                  onClick={testTelegramConnection}
                  disabled={!settings.telegram_bot_token}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  Test Connection
                </button>
              </div>
            </div>

            {/* Status */}
            {hasBotConfigured ? (
              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#22c55e]" />
                <span className="text-[#22c55e]">Your own Telegram bot is configured — files will be stored in your private Telegram storage</span>
              </div>
            ) : hasGlobalBot ? (
              <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-xl p-4 flex items-start gap-3">
                <Bot className="w-5 h-5 text-[#3b82f6] mt-0.5" />
                <div>
                  <span className="text-[#3b82f6] font-medium">No personal bot configured — using shared bot</span>
                  <p className="text-[#3b82f6]/70 text-sm mt-1">
                    You can upload files using the admin&apos;s shared Telegram bot. For private storage, set up your own bot above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
                <span className="text-[#f59e0b]">No Telegram bot available — you won&apos;t be able to upload files until you or the admin configures a bot</span>
              </div>
            )}
          </div>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Storage Usage</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[var(--muted)]">Used</span>
                    <span className="text-[var(--foreground)] font-medium">{formatSize(user?.storage_used || 0)}</span>
                  </div>
                  <div className="h-3 bg-[var(--secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6366f1] to-[#22d3ee] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(((user?.storage_used || 0) / (user?.storage_limit || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[var(--muted)] text-sm">0 B</span>
                    <span className="text-[var(--muted)] text-sm">{formatSize(user?.storage_limit || 0)} limit</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                  <div className="bg-[var(--secondary)] rounded-xl p-4">
                    <p className="text-[var(--muted)] text-sm">Storage Used</p>
                    <p className="text-2xl font-bold text-[var(--foreground)]">{formatSize(user?.storage_used || 0)}</p>
                  </div>
                  <div className="bg-[var(--secondary)] rounded-xl p-4">
                    <p className="text-[var(--muted)] text-sm">Available</p>
                    <p className="text-2xl font-bold text-[var(--foreground)]">{formatSize((user?.storage_limit || 0) - (user?.storage_used || 0))}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Need More Storage?</h3>
              <p className="text-[var(--muted)] mb-4">Upgrade to get more storage space and premium features.</p>
              <button className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all">
                Upgrade Plan
              </button>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Theme</h3>
              <p className="text-[var(--muted)] text-sm mb-4">Choose how TeleCloud looks to you. Select &quot;System&quot; to follow your device&apos;s theme.</p>
              
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-[#6366f1] bg-[#6366f1]/10'
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#f8fafc] border border-[var(--border)] flex items-center justify-center">
                    <Sun className="w-6 h-6 text-[#f59e0b]" />
                  </div>
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-[#6366f1]' : 'text-[var(--foreground)]'}`}>Light</span>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-[#6366f1] bg-[#6366f1]/10'
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#1e1e2e] border border-[var(--border)] flex items-center justify-center">
                    <Moon className="w-6 h-6 text-[#6366f1]" />
                  </div>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#6366f1]' : 'text-[var(--foreground)]'}`}>Dark</span>
                </button>

                <button
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'system'
                      ? 'border-[#6366f1] bg-[#6366f1]/10'
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f8fafc] to-[#1e1e2e] border border-[var(--border)] flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-[var(--foreground)]" />
                  </div>
                  <span className={`text-sm font-medium ${theme === 'system' ? 'text-[#6366f1]' : 'text-[var(--foreground)]'}`}>System</span>
                </button>
              </div>

              <div className="mt-4 p-3 bg-[var(--secondary)] rounded-lg">
                <p className="text-sm text-[var(--muted)]">
                  Current: <span className="text-[var(--foreground)] font-medium">{resolvedTheme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-slideIn z-50">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {saved && (
          <div className="fixed bottom-4 right-4 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3 animate-slideIn z-50">
            <Check className="w-5 h-5 text-[#22c55e]" />
            <span className="text-[#22c55e]">Settings saved successfully!</span>
          </div>
        )}

        {/* Save Button */}
        {activeTab !== 'appearance' && (
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--card)]/80 backdrop-blur-xl border-t border-[var(--border)] p-4 z-40">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
