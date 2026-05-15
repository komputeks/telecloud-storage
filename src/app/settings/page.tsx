'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { 
  Settings, Bot, MessageSquare, Save, Loader2, Check, AlertCircle, 
  Eye, EyeOff, HelpCircle, HardDrive, User, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

interface UserSettings {
  name: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'telegram' | 'storage'>('telegram');
  
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
  });

  useEffect(() => {
    if (user) {
      setSettings({
        name: user.name || '',
        telegram_bot_token: '',
        telegram_chat_id: '',
      });
      setLoading(false);
    }
  }, [user]);

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
      setTestResult({ success: false, message: 'Please enter a bot token first' });
      return;
    }

    setTestResult(null);
    
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
        setTestResult({ 
          success: true, 
          message: `Connected to @${data.bot_username}${data.chat_title ? ` (${data.chat_title})` : ''}` 
        });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Connection failed' });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#111118]/80 backdrop-blur-xl border-b border-[#27272a]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-[#1e1e2e] transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-xs text-gray-500">Configure your account and Telegram bot</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'telegram', label: 'Telegram Bot', icon: Bot },
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'storage', label: 'Storage', icon: HardDrive },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-[#1e1e2e] text-gray-400 hover:bg-[#27272a]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {/* Telegram Tab */}
        {activeTab === 'telegram' && (
          <div className="space-y-6">
            {/* Setup Guide */}
            <div className="bg-gradient-to-r from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-[#6366f1]/30">
                  <HelpCircle className="w-6 h-6 text-[#6366f1]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">How to Setup Your Telegram Bot</h3>
                  <ol className="text-sm text-gray-300 space-y-2">
                    <li><span className="text-[#6366f1] font-semibold">1.</span> Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-[#22d3ee] hover:underline">@BotFather</a></li>
                    <li><span className="text-[#6366f1] font-semibold">2.</span> Send <code className="bg-[#1e1e2e] px-2 py-0.5 rounded">/newbot</code> and follow the instructions</li>
                    <li><span className="text-[#6366f1] font-semibold">3.</span> Copy the bot token you receive</li>
                    <li><span className="text-[#6366f1] font-semibold">4.</span> Create a channel or group and add your bot as admin</li>
                    <li><span className="text-[#6366f1] font-semibold">5.</span> Forward a message from your channel to <a href="https://t.me/userinfobot" target="_blank" rel="noopener" className="text-[#22d3ee] hover:underline">@userinfobot</a> to get the Chat ID</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-[#111118] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#6366f1]" />
                Your Telegram Bot
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bot Token</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={settings.telegram_bot_token}
                      onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                      className="w-full px-4 py-3 pr-12 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1] transition-colors font-mono text-sm"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Get this from @BotFather on Telegram</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={settings.telegram_chat_id}
                    onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1] transition-colors"
                    placeholder="-1001234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">Channel or group ID where files will be stored</p>
                </div>

                <button
                  onClick={testTelegramConnection}
                  disabled={!settings.telegram_bot_token}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] hover:bg-[#27272a] text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  Test Connection
                </button>

                {testResult && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    testResult.success 
                      ? 'bg-[#22c55e]/10 border border-[#22c55e]/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    {testResult.success ? (
                      <Check className="w-5 h-5 text-[#22c55e]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={testResult.success ? 'text-[#22c55e]' : 'text-red-400'}>
                      {testResult.message}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            {settings.telegram_bot_token && settings.telegram_chat_id ? (
              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#22c55e]" />
                <span className="text-[#22c55e]">Telegram bot configured - Your files will be stored in your own Telegram storage</span>
              </div>
            ) : (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
                <span className="text-[#f59e0b]">Configure your Telegram bot to start uploading files</span>
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1] transition-colors"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-[#1e1e2e]/50 border border-[#27272a] rounded-xl text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="bg-[#111118] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Storage Usage</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">Used</span>
                    <span className="text-white font-medium">{formatSize(user?.storage_used || 0)}</span>
                  </div>
                  <div className="h-4 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6366f1] to-[#22d3ee] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(((user?.storage_used || 0) / (user?.storage_limit || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-500 text-sm">0 B</span>
                    <span className="text-gray-500 text-sm">{formatSize(user?.storage_limit || 0)} limit</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#27272a]">
                  <div className="bg-[#1e1e2e] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Storage Used</p>
                    <p className="text-2xl font-bold text-white">{formatSize(user?.storage_used || 0)}</p>
                  </div>
                  <div className="bg-[#1e1e2e] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Available</p>
                    <p className="text-2xl font-bold text-white">{formatSize((user?.storage_limit || 0) - (user?.storage_used || 0))}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#111118] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Need More Storage?</h3>
              <p className="text-gray-400 mb-4">Upgrade to get more storage space and premium features.</p>
              <button className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all">
                Upgrade Plan
              </button>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="fixed bottom-24 right-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-slideIn z-50">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {saved && (
          <div className="fixed bottom-24 right-4 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3 animate-slideIn z-50">
            <Check className="w-5 h-5 text-[#22c55e]" />
            <span className="text-[#22c55e]">Settings saved!</span>
          </div>
        )}
      </main>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111118]/90 backdrop-blur-xl border-t border-[#27272a] p-4 z-40">
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
    </div>
  );
}
