'use client';

import { useAuth } from '@/components/AuthProvider';
import { AdminPanel } from '@/components/AdminPanel';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  if (!user || !user.is_admin) {
    return null;
  }

  return <AdminPanel />;
}
