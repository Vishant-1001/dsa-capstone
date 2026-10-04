import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button } from './ui';
import { clsx } from '../utils/format';

const SPEEDS = [1, 2, 4];

/** Simulation speed and pause. Changes apply to every ambulance on the server. */
export default function SimControls({ compact }) {
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const [busy, setBusy] = useState(false);
  if (!live) return null;

  const update = async (body) => {
    setBusy(true);
    try {
      await api.put('/sim', body);
      await refresh();
    } catch (err) {
      toasts.error('Could not update the simulation', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2" aria-label="Simulation controls">
      {!compact && <span className="panel-title hidden xl:inline">Speed</span>}
      <div className="inline-flex overflow-hidden rounded border border-ink-500" role="radiogroup" aria-label="Simulation speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={live.speed === s}
            disabled={busy}
            onClick={() => update({ speed: s })}
            className={clsx('border-r border-ink-500 px-2.5 py-1 font-mono text-xs last:border-r-0', live.speed === s ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-ink-600')}
          >
            {s}x
          </button>
        ))}
      </div>
      <Button size="sm" onClick={() => update({ paused: !live.paused })} disabled={busy} title={live.paused ? 'Resume simulation' : 'Pause simulation'}>
        {live.paused ? <Play size={14} /> : <Pause size={14} />}
        {live.paused ? 'Resume' : 'Pause'}
      </Button>
    </div>
  );
}
