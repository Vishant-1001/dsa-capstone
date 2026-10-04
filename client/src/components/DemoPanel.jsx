import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, FlaskConical, Loader2, X, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button } from './ui';

/** Starts the scripted scenario. It uses the real services on the server. */
export function RunDemoButton({ variant = 'secondary', size, className }) {
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const running = Boolean(live && live.demo && live.demo.running);

  const start = async () => {
    setBusy(true);
    try {
      await api.post('/sim/demo');
      await refresh();
      navigate('/map');
    } catch (err) {
      toasts.error('Demo could not start', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={start} loading={busy} disabled={running} title="Run the scripted end-to-end scenario">
      <FlaskConical size={15} />
      {running ? 'Demo running' : 'Run demo'}
    </Button>
  );
}

const ICON = {
  done: <CheckCircle2 size={15} className="text-ok" />,
  active: <Loader2 size={15} className="animate-spin text-accent" />,
  pending: <Circle size={15} className="text-ink-500" />,
  failed: <AlertTriangle size={15} className="text-crit" />,
  stopped: <Circle size={15} className="text-faint" />,
};

/** Progress card for the scripted scenario, visible on every page. */
export default function DemoPanel() {
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const demo = live && live.demo;
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [seenRunning, setSeenRunning] = useState(false);

  useEffect(() => {
    if (demo && demo.running) {
      setHidden(false);
      setSeenRunning(true);
    }
  }, [demo && demo.running]);

  // A finished run left over from before a page reload stays out of the way.
  if (!demo || hidden || (!demo.running && !seenRunning)) return null;

  const stop = async () => {
    try {
      await api.del('/sim/demo');
      await refresh();
    } catch (err) {
      toasts.error('Could not stop the demo', err.message);
    }
  };

  const activeIndex = demo.steps.findIndex((s) => s.status === 'active');
  const doneCount = demo.steps.filter((s) => s.status === 'done').length;

  return (
    <aside className="fixed bottom-4 left-4 z-40 flex max-h-[70vh] w-[23rem] max-w-[calc(100vw-2rem)] flex-col rounded border border-line bg-ink-800 lg:left-[17rem]" aria-label="Scripted demo progress">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <div className="panel-title">Scripted demo</div>
          <div className="text-xs text-muted">
            {demo.running ? `Step ${Math.min(doneCount + 1, demo.total)} of ${demo.total}` : demo.finished ? 'Completed' : demo.error ? 'Stopped with an error' : 'Stopped'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded p-1 text-muted hover:text-fg" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand demo steps' : 'Collapse demo steps'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {demo.running ? (
            <Button size="sm" onClick={stop}>
              Stop
            </Button>
          ) : (
            <button type="button" className="text-muted hover:text-fg" onClick={() => setHidden(true)} aria-label="Close demo panel">
              <X size={16} />
            </button>
          )}
        </div>
      </header>
      {demo.error && <div className="border-b border-line bg-crit/10 px-4 py-2 text-xs text-red-200">{demo.error}</div>}
      <ol className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 ${collapsed ? 'hidden' : ''}`}>
        {demo.steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5 pb-2.5 last:pb-0">
            <span className="mt-0.5 shrink-0">{ICON[s.status] || ICON.pending}</span>
            <div className="min-w-0">
              <div className={s.status === 'pending' ? 'text-sm text-faint' : 'text-sm text-fg'}>
                {i + 1}. {s.title}
              </div>
              {s.detail && (i === activeIndex || s.status === 'done' || s.status === 'failed') && <div className="mt-0.5 break-words text-xs text-muted">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
