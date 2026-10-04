import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLive } from '../hooks/useLive';
import { fmtTime } from '../utils/format';

const COLOR = { success: '#3fb68b', info: '#4aa3df', warning: '#e0a93a', critical: '#e5484d' };

export default function NotificationsMenu() {
  const { live } = useLive();
  const [open, setOpen] = useState(false);
  const [readUpTo, setReadUpTo] = useState(0);
  const ref = useRef(null);
  const primed = useRef(false);
  const notes = live ? live.notifications : [];
  const newest = notes.length ? notes[notes.length - 1].id : 0;
  const unread = notes.filter((n) => n.id > readUpTo).length;

  // Notifications that existed before this page loaded are not counted as unread.
  useEffect(() => {
    if (live && !primed.current) {
      primed.current = true;
      setReadUpTo(newest);
    }
  }, [live, newest]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    setReadUpTo(newest);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="relative rounded p-2 text-muted hover:bg-ink-700 hover:text-fg" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-[16px] rounded-sm bg-crit px-1 text-center font-mono text-[10px] leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[24rem] max-w-[calc(100vw-1.5rem)] rounded border border-line bg-ink-800">
          <div className="border-b border-line px-4 py-2.5 panel-title">Notifications</div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {notes.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted">Nothing yet. Events from emergencies, dispatches and traffic appear here.</li>}
            {notes
              .slice()
              .reverse()
              .map((n) => (
                <li key={n.id} className="border-b border-line/70 px-4 py-2.5 last:border-b-0" style={{ borderLeft: `3px solid ${COLOR[n.level] || COLOR.info}` }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-fg">{n.title}</span>
                    <span className="shrink-0 font-mono text-2xs text-faint">{fmtTime(n.at)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{n.message}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
