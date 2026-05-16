'use client';

import { useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastContextType {
  toast: (type: ToastItem['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <ToastNotification key={t.id} item={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastNotification({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[#22c55e] flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#f59e0b] flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-[#6366f1] flex-shrink-0" />,
  };

  const borders = {
    success: 'border-[#22c55e]/30',
    error: 'border-[#ef4444]/30',
    warning: 'border-[#f59e0b]/30',
    info: 'border-[#6366f1]/30',
  };

  const bgs = {
    success: 'bg-[#22c55e]/10',
    error: 'bg-[#ef4444]/10',
    warning: 'bg-[#f59e0b]/10',
    info: 'bg-[#6366f1]/10',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border ${borders[item.type]} ${bgs[item.type]} backdrop-blur-xl shadow-2xl animate-fadeIn`}
    >
      {icons[item.type]}
      <p className="text-sm text-[var(--foreground)] flex-1 leading-relaxed">{item.message}</p>
      <button onClick={onDismiss} className="text-[var(--muted)] hover:text-[var(--foreground)] flex-shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
