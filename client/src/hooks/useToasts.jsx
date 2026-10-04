import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);
const LEVEL_COLOR = { success: '#3fb68b', info: '#4aa3df', warning: '#e0a93a', critical: '#e5484d', error: '#e5484d' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    ({ level = 'info', title, message }) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list.slice(-3), { id, level, title, message }]);
      const ttl = level === 'critical' || level === 'error' ? 9000 : 6000;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      push,
      success: (title, message) => push({ level: 'success', title, message }),
      error: (title, message) => push({ level: 'error', title, message }),
      info: (title, message) => push({ level: 'info', title, message }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex gap-3 rounded border border-line bg-ink-700 p-3"
            style={{ borderLeft: `3px solid ${LEVEL_COLOR[t.level] || LEVEL_COLOR.info}` }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-fg">{t.title}</div>
              {t.message && <div className="mt-0.5 break-words text-xs text-muted">{t.message}</div>}
            </div>
            <button type="button" className="h-5 w-5 shrink-0 text-muted hover:text-fg" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside ToastProvider');
  return ctx;
}
