'use client';

import { useAuth } from '@/components/AuthProvider';
import { LandingPage } from '@/components/LandingPage';
import { FileManager } from '@/components/FileManager';
import { AdminPanel } from '@/components/AdminPanel';
import { UserSettingsPage } from '@/components/UserSettingsPage';
import { AuthModal } from '@/components/AuthModal';
import { useState, useRef, useEffect } from 'react';
import { Loader2, LogOut, Settings, ChevronDown, User, FolderOpen, Shield } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

type Page = 'files' | 'admin' | 'settings';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('files');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show loading screen
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

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
  };

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return user.is_admin ? <AdminPanel /> : <FileManager />;
      case 'settings':
        return <UserSettingsPage />;
      default:
        return <FileManager />;
    }
  };

  // Show dashboard for authenticated users
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* User dropdown in top right */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-2" ref={dropdownRef}>
          {/* Navigation tabs */}
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
              <span className="text-sm">Files</span>
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
                    onClick={() => {
                      setCurrentPage('files');
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                    Files
                  </button>
                  {user.is_admin && (
                    <button
                      onClick={() => {
                        setCurrentPage('admin');
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                    >
                      <Shield className="w-5 h-5" />
                      Admin Panel
                    </button>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setCurrentPage('settings');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  Settings
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      {renderPage()}
      
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
