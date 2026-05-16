'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import {
  Users, Settings, BarChart3, Shield, Database, Globe,
  RefreshCw, Trash2, Edit, Save, Loader2, AlertCircle,
  HardDrive, FileText, Key, Bot, Check, Eye, EyeOff
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  storage_used: number;
  storage_limit: number;
  is_upgraded: boolean;
  created_at: string;
}

interface EnvVariable {
  key: string;
  value: string;
  description: string;
  is_secret: boolean;
  is_set?: boolean;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFiles: 0,
    totalStorage: 0,
  });

  // Settings state
  const [settings, setSettings] = useState({
    site_name: 'TeleCloud Storage',
    max_file_size: '52428800',
    default_storage_limit: '52428800',
    allow_registration: 'true',
  });

  // Environment variables state
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([
    { key: 'TELEGRAM_BOT_TOKEN', value: '', description: 'Global Telegram Bot Token (fallback for users without their own bot)', is_secret: true },
    { key: 'TELEGRAM_CHAT_ID', value: '', description: 'Global Telegram Chat ID (fallback for users without their own bot)', is_secret: false },
    { key: 'JWT_SECRET', value: '', description: 'JWT Secret for authentication tokens', is_secret: true },
  ]);
  
  const [showEnvValue, setShowEnvValue] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.is_admin) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, settingsRes, envRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/env'),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        
        const totalStorage = data.users?.reduce((sum: number, u: User) => sum + u.storage_used, 0) || 0;
        setStats({
          totalUsers: data.users?.length || 0,
          totalFiles: 0,
          totalStorage,
        });
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
      
      if (envRes.ok) {
        const data = await envRes.json();
        if (data.variables) {
          setEnvVariables(prev => prev.map(env => {
            const found = data.variables.find((v: { key: string; value: string; is_set?: boolean }) => v.key === env.key);
            return found ? { ...env, value: found.value || '', is_set: found.is_set } : env;
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates }),
      });

      if (res.ok) {
        await fetchData();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveEnvVariables = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: envVariables }),
      });
      
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save env variables:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Access Denied</h2>
          <p className="text-[var(--muted)]">You don't have admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#22d3ee] to-[#6366f1]">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--foreground)]">Admin Panel</h1>
                <p className="text-xs text-[var(--muted)]">Manage your TeleCloud instance</p>
              </div>
            </div>

            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'env', label: 'Environment', icon: Key },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
          </div>
        ) : activeTab === 'overview' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#6366f1]/20">
                  <Users className="w-6 h-6 text-[#6366f1]" />
                </div>
                <div>
                  <p className="text-[var(--muted)] text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{stats.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#22d3ee]/20">
                  <FileText className="w-6 h-6 text-[#22d3ee]" />
                </div>
                <div>
                  <p className="text-[var(--muted)] text-sm">Total Files</p>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{stats.totalFiles}</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#22c55e]/20">
                  <Database className="w-6 h-6 text-[#22c55e]" />
                </div>
                <div>
                  <p className="text-[var(--muted)] text-sm">Total Storage</p>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{formatSize(stats.totalStorage)}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Recent Users</h3>
              <div className="space-y-3">
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold">
                        {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[var(--foreground)]">{u.name || u.email}</p>
                        <p className="text-xs text-[var(--muted)]">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--muted)]">{formatSize(u.storage_used)} used</p>
                      <p className="text-xs text-[var(--muted)]">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase">Storage</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold">
                          {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[var(--foreground)]">{u.name || 'No name'}</p>
                          <p className="text-xs text-[var(--muted)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--muted)]">{formatSize(u.storage_used)}</span>
                          <span className="text-[var(--muted)]">{formatSize(u.storage_limit)}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#6366f1] to-[#22d3ee] rounded-full"
                            style={{ width: `${Math.min((u.storage_used / u.storage_limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        u.is_admin ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-[var(--border)] text-[var(--muted)]'
                      }`}>
                        {u.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(u.id)}
                          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                General Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Site Name</label>
                  <input
                    type="text"
                    value={settings.site_name}
                    onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Max File Size (bytes)</label>
                  <input
                    type="number"
                    value={settings.max_file_size}
                    onChange={(e) => setSettings({ ...settings, max_file_size: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Default: 52428800 (50MB)</p>
                </div>

                <div>
                  <label className="block text-sm text-[var(--muted)] mb-2">Default Storage Limit (bytes)</label>
                  <input
                    type="number"
                    value={settings.default_storage_limit}
                    onChange={(e) => setSettings({ ...settings, default_storage_limit: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Default: 10737418240 (10GB)</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Allow Registration</span>
                  <input
                    type="checkbox"
                    checked={settings.allow_registration === 'true'}
                    onChange={(e) => setSettings({ ...settings, allow_registration: e.target.checked ? 'true' : 'false' })}
                    className="w-5 h-5 rounded bg-[var(--secondary)] border-[var(--border)] text-[#6366f1] focus:ring-[#6366f1]"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {saved && (
              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#22c55e]" />
                <span className="text-[#22c55e]">Settings saved successfully!</span>
              </div>
            )}
          </div>
        ) : activeTab === 'env' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-[#f59e0b]/20 to-[#ef4444]/20 border border-[#f59e0b]/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#f59e0b] mt-0.5" />
                <div>
                  <p className="text-[#f59e0b] font-medium">Important</p>
                  <p className="text-[var(--muted)] text-sm">Environment variables are stored in the database. These serve as global fallbacks when users haven't configured their own Telegram bot.</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Telegram Configuration (Global Fallback)
              </h3>
              <p className="text-[var(--muted)] text-sm mb-4">
                These credentials are used when users haven't configured their own Telegram bot. Each user can set up their own bot in their settings.
              </p>
              
              <div className="space-y-4">
                {envVariables.map((env, index) => (
                  <div key={env.key}>
                    <label className="block text-sm text-[var(--muted)] mb-2">
                      {env.key}
                      {env.is_secret && <span className="ml-2 text-xs text-[#f59e0b]">(Secret)</span>}
                      {env.is_set && !env.value && <span className="ml-2 text-xs text-[#22c55e]">(Already set)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={env.is_secret && !showEnvValue[env.key] ? 'password' : 'text'}
                        value={env.value}
                        onChange={(e) => {
                          const newEnv = [...envVariables];
                          newEnv[index].value = e.target.value;
                          setEnvVariables(newEnv);
                        }}
                        placeholder={env.key === 'TELEGRAM_BOT_TOKEN' ? '123456789:ABCdef...' : env.key === 'TELEGRAM_CHAT_ID' ? '-1001234567890' : '••••••••'}
                        className="w-full px-4 py-3 pr-10 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] font-mono text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
                      />
                      {env.is_secret && (
                        <button
                          type="button"
                          onClick={() => setShowEnvValue(prev => ({ ...prev, [env.key]: !prev[env.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          {showEnvValue[env.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">{env.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveEnvVariables}
              disabled={saving}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Saving...' : 'Save Environment Variables'}
            </button>

            {saved && (
              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#22c55e]" />
                <span className="text-[#22c55e]">Environment variables saved!</span>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
