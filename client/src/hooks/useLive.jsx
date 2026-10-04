import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './useAuth';
import { useToasts } from './useToasts';

const LiveContext = createContext(null);

/**
 * Polls the single /api/live snapshot and the (rarely changing) graph.
 * Every page reads shared state from here, so numbers stay consistent.
 */
export function LiveProvider({ children }) {
  const { user } = useAuth();
  const toasts = useToasts();
  const [live, setLive] = useState(null);
  const [graph, setGraph] = useState(null);
  const [online, setOnline] = useState(true);
  const [lastError, setLastError] = useState(null);

  const liveRef = useRef(null);
  const graphVersion = useRef(null);
  const lastNote = useRef(null);
  const failures = useRef(0);
  const timer = useRef(null);
  const busy = useRef(false);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await api.get('/live');
      failures.current = 0;
      setOnline(true);
      setLastError(null);
      liveRef.current = data;
      setLive(data);

      if (graphVersion.current !== data.graphVersion) {
        const g = await api.get('/graph');
        graphVersion.current = data.graphVersion;
        setGraph(g);
      }

      const notes = data.notifications || [];
      const newest = notes.length ? notes[notes.length - 1].id : 0;
      if (lastNote.current === null) {
        lastNote.current = newest;
      } else {
        notes.filter((n) => n.id > lastNote.current).forEach((n) => toastsRef.current.push({ level: n.level, title: n.title, message: n.message }));
        lastNote.current = Math.max(lastNote.current, newest);
      }
    } catch (err) {
      failures.current += 1;
      if (failures.current >= 2) setOnline(false);
      setLastError(err.message);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      liveRef.current = null;
      graphVersion.current = null;
      lastNote.current = null;
      setLive(null);
      setGraph(null);
      return undefined;
    }
    let stopped = false;
    const loop = async () => {
      await poll();
      if (stopped) return;
      const moving = liveRef.current && liveRef.current.missions.length > 0;
      timer.current = window.setTimeout(loop, moving ? 500 : 1500);
    };
    loop();
    return () => {
      stopped = true;
      window.clearTimeout(timer.current);
    };
  }, [user, poll]);

  const nodeById = useMemo(() => {
    const out = {};
    if (graph) graph.nodes.forEach((n) => { out[n.id] = n; });
    return out;
  }, [graph]);

  const value = useMemo(() => ({ live, graph, nodeById, online, lastError, refresh: poll }), [live, graph, nodeById, online, lastError, poll]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside LiveProvider');
  return ctx;
}
