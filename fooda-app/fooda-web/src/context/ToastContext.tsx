import React, { createContext, useCallback, useContext, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextType {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export const useToast = () => useContext(ToastContext);

const KIND_STYLES: Record<ToastKind, { bg: string; color: string; icon: string }> = {
  success: { bg: '#16a34a', color: '#fff', icon: '✓' },
  error:   { bg: '#dc2626', color: '#fff', icon: '✕' },
  info:    { bg: '#1f2937', color: '#fff', icon: 'ℹ' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => remove(id), 4000);
  }, []);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast]);
  const info    = useCallback((m: string) => toast(m, 'info'),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
          maxWidth: 360,
        }}
      >
        {toasts.map(t => {
          const s = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              onClick={() => remove(t.id)}
              style={{
                background: s.bg,
                color: s.color,
                padding: '12px 16px',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 14,
                fontWeight: 500,
                pointerEvents: 'auto',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                animation: 'fooda-toast-in 0.18s ease-out',
              }}
            >
              <span style={{ fontWeight: 700 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          );
        })}
        <style>{`
          @keyframes fooda-toast-in {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </ToastContext.Provider>
  );
};
