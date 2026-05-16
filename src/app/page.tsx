'use client';

import { useAuth } from '@/components/AuthProvider';
import { LandingPage } from '@/components/LandingPage';
import { FileManager } from '@/components/FileManager';
import { AdminPanel } from '@/components/AdminPanel';
import { UserSettingsPage } from '@/components/UserSettingsPage';
import { MessagesPage } from '@/components/MessagesPage';
import { AuthModal } from '@/components/AuthModal';
import { UpgradeModal } from '@/components/UpgradeModal';
import { useState, useRef, useEffect } from 'react';
import { Loader2, Settings, ChevronDown, User, FolderOpen, Shield, MessageSquare, Sparkles, Crown } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

type Page = 'files' | 'admin' | 'settings' | 'messages';

export default function Home() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('files');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#6366f1] animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted)]">Loading TeleCloud...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return user.is_admin ? <AdminPanel /> : <FileManager />;
      case 'settings':
        return <UserSettingsPage />;
      case 'messages':
        return <MessagesPage />;
      default:
        return <FileManager />;
    }
  };

  const isUpgraded = user.is_upgraded || user.storage_limit === 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top nav */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2" ref={dropdownRef}>
          {/* Desktop navigation tabs */}
          <div className="hidden md:flex items-center gap-1 mr-2 bg-[var(--secondary)] rounded-xl p-1">
            <button
              onClick={() => setCurrentPage('files')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'files'
                  ? 'bg-[#6366f1] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm">File Manager</span>
            </button>
            <button
              onClick={() => setCurrentPage('messages')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'messages'
                  ? 'bg-[#6366f1] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">Messages</span>
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'settings'
                  ? 'bg-[#6366f1] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Profile Settings</span>
            </button>
            {user.is_admin && (
              <button
                onClick={() => setCurrentPage('admin')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentPage === 'admin'
                    ? 'bg-[#6366f1] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm">Admin</span>
              </button>
            )}
          </div>

          {/* Go Pro / Upgraded badge */}
          {!isUpgraded ? (
            <button
              onClick={() => setShowUpgrade(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white rounded-xl text-xs font-medium transition-all"
            >
              <Crown className="w-3.5 h-3.5" />
              Go Pro
            </button>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[#6366f1]/10 text-[#6366f1] rounded-xl text-xs font-medium border border-[#6366f1]/20">
              <Sparkles className="w-3.5 h-3.5" />
              Pro
            </div>
          )}

          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-xl transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold">
              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <ChevronDown className={`w-4 h-4 text-[var(--muted)] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl animate-fadeIn">
              <div className="p-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold">
                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[var(--foreground)] font-medium">{user.name || 'User'}</p>
                    <p className="text-xs text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                {/* Mobile navigation */}
                <div className="md:hidden">
                  <button
                    onClick={() => { setCurrentPage('files'); setShowDropdown(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" /> File Manager
                  </button>
                  <button
                    onClick={() => { setCurrentPage('messages'); setShowDropdown(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" /> Messages
                  </button>
                  <button
                    onClick={() => { setCurrentPage('settings'); setShowDropdown(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                  >
                    <Settings className="w-5 h-5" /> Profile Settings
                  </button>
                  {user.is_admin && (
                    <button
                      onClick={() => { setCurrentPage('admin'); setShowDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                    >
                      <Shield className="w-5 h-5" /> Admin Panel
                    </button>
                  )}
                  {!isUpgraded && (
                    <button
                      onClick={() => { setShowUpgrade(true); setShowDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-[#6366f1] hover:bg-[#6366f1]/10 rounded-lg transition-colors"
                    >
                      <Crown className="w-5 h-5" /> Go Pro
                    </button>
                  )}
                </div>
                
                {/* Desktop: just show Go Pro link if not upgraded */}
                <div className="hidden md:block">
                  {!isUpgraded && (
                    <button
                      onClick={() => { setShowUpgrade(true); setShowDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-[#6366f1] hover:bg-[#6366f1]/10 rounded-lg transition-colors"
                    >
                      <Crown className="w-5 h-5" /> Go Pro
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {renderPage()}
      
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
