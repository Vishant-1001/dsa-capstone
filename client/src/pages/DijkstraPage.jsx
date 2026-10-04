import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import CityMap from '../components/CityMap';
import { Button, ErrorNote, Panel, Select, Spinner, Tag } from '../components/ui';
import { fmtKm, fmtMin, pathString } from '../utils/format';

const DELAY = 900;

export default function DijkstraPage() {
  const { graph, live, nodeById } = useLive();
  const [source, setSource] = useState('ST1');
  const [target, setTarget] = useState('HN3');
  const [route, setRoute] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const nodes = useMemo(() => (graph ? graph.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)) : []), [graph]);
  const steps = route ? route.steps : [];
  const last = steps.length - 1;
  const finished = route && step >= last;

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= last) {
      setPlaying(false);
      return undefined;
    }
    timer.current = window.setTimeout(() => setStep((s) => Math.min(s + 1, last)), DELAY);
    return () => window.clearTimeout(timer.current);
  }, [playing, step, last]);

  const run = async () => {
    setBusy(true);
    setError('');
    setPlaying(false);
    try {
      const res = await api.post('/routes/calculate', { source, target, trace: true });
      setRoute(res.route);
      setStep(0);
      if (!res.route.found) setError('No route exists between these nodes with the current road closures.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [cmp, setCmp] = useState(null);
  useEffect(() => setCmp(null), [source, target]);

  const runCompare = async () => {
    try {
      setCmp(await api.post('/routes/compare', { source, target }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = () => {
    setPlaying(false);
    setStep(0);
  };

  if (!graph || !live) return <Spinner />;

  const current = steps[step];
  const colors = {};
  const notes = {};
  const lines = [];
  if (current) {
    current.visited.forEach((id) => { colors[id] = '#3fb68b'; });
    current.heap.forEach((h) => { if (!colors[h.nodeId]) colors[h.nodeId] = '#e0a93a'; });
    if (current.current) colors[current.current] = '#4aa3df';
    colors[source] = colors[source] || '#4aa3df';
    Object.keys(current.distances).forEach((id) => {
      if (current.distances[id] !== null) notes[id] = String(current.distances[id]);
    });
    Object.keys(current.previous).forEach((id) => {
      lines.push({ key: `prev-${id}`, path: [current.previous[id], id], color: '#4aa3df', width: 2.5, opacity: 0.55 });
    });
  }
  if (finished && route && route.found) {
    lines.push({ key: 'final', path: route.path, color: '#3fb68b', width: 6, opacity: 0.95 });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="dj-source">
                Source
              </label>
              <Select id="dj-source" className="input" value={source} onChange={(e) => { setSource(e.target.value); setRoute(null); }}>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="label" htmlFor="dj-target">
                Destination
              </label>
              <Select id="dj-target" className="input" value={target} onChange={(e) => { setTarget(e.target.value); setRoute(null); }}>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" onClick={run} loading={busy} disabled={source === target}>
              RUN DIJKSTRA
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="ok" onClick={() => (finished ? (setStep(0), setPlaying(true)) : setPlaying(true))} disabled={!route || !route.found || playing}>
              <Play size={14} /> START
            </Button>
            <Button onClick={() => setPlaying(false)} disabled={!playing}>
              <Pause size={14} /> PAUSE
            </Button>
            <Button onClick={() => { setPlaying(false); setStep((s) => Math.min(s + 1, last)); }} disabled={!route || finished}>
              <SkipForward size={14} /> NEXT STEP
            </Button>
            <Button onClick={reset} disabled={!route}>
              <RotateCcw size={14} /> RESET
            </Button>
            {route && <span className="ml-auto font-mono text-xs text-muted">Step {step} of {last}</span>}
          </div>
          <ErrorNote className="mt-3">{error}</ErrorNote>
        </Panel>

        <Panel title="Dijkstra compared with A*">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runCompare} disabled={source === target}>
              Compare algorithms
            </Button>
            <span className="text-xs text-muted">A* adds a straight-line travel time estimate to each heap key, so it usually visits fewer nodes and still finds the same fastest route.</span>
          </div>
          {cmp && (
            <table className="tbl mt-3">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th className="text-right">Nodes visited</th>
                  <th className="text-right">Heap inserts</th>
                  <th className="text-right">Roads relaxed</th>
                  <th className="text-right">Travel time</th>
                  <th className="text-right">Distance</th>
                </tr>
              </thead>
              <tbody>
                {[cmp.dijkstra, cmp.astar].map((r) => (
                  <tr key={r.algorithm}>
                    <td>{r.algorithm}</td>
                    <td className="text-right font-mono">{r.visitedNodes.length}</td>
                    <td className="text-right font-mono">{r.stats.heapInserts}</td>
                    <td className="text-right font-mono">{r.stats.relaxations}</td>
                    <td className="text-right font-mono">{r.found ? fmtMin(r.estimatedTime) : 'none'}</td>
                    <td className="text-right font-mono">{r.found ? fmtKm(r.totalDistance) : 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel flush className="overflow-hidden">
          <div className="aspect-[1000/620] w-full">
            <CityMap graph={graph} live={live} showLabels showAmbulances={false} showEmergencies={false} showMissionRoutes={false} nodeColors={colors} nodeNotes={notes} routes={lines} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: '#4aa3df' }} />Current node</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: '#3fb68b' }} />Visited (shortest distance final)</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: '#e0a93a' }} />In the heap</span>
            <span>Numbers: tentative travel time in minutes. Thin blue lines: best known predecessor.</span>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        {!route && (
          <Panel title="How it works">
            <p className="text-sm text-muted">Choose a source and destination, then run Dijkstra. The server records every step: the node taken from the min-heap, the roads relaxed and the heap afterwards. Step through the trace here.</p>
            <p className="mt-3 text-sm text-muted">Closed roads are ignored and travel times include current traffic, so closing a road on the map changes the result.</p>
          </Panel>
        )}

        {current && (
          <>
            <Panel title="Current step">
              {step === 0 ? (
                <p className="text-sm text-muted">
                  Start: every distance is infinite except the source, which is 0. The heap holds only <span className="font-mono text-fg">{source}</span>.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    Took <span className="font-mono text-accent">{current.current}</span> ({nodeById[current.current] ? nodeById[current.current].name : ''}) from the heap at <span className="font-mono">{current.currentDistance} min</span>. It is now final.
                  </p>
                  {current.relaxed.length === 0 ? (
                    <p className="text-xs text-muted">No neighbouring road gave a shorter route.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted">
                      {current.relaxed.map((r) => (
                        <li key={`${r.from}-${r.to}`}>
                          Relaxed {r.roadId}: <span className="font-mono text-fg">{r.to}</span> now {r.distance} min via {r.from}
                        </li>
                      ))}
                    </ul>
                  )}
                  {current.current === target && <p className="text-xs text-ok">Destination reached. The search stops here.</p>}
                </div>
              )}
            </Panel>

            <Panel title={`Heap contents (${current.heap.length})`}>
              {current.heap.length === 0 ? (
                <p className="text-xs text-muted">Empty</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {current.heap.map((h, i) => (
                    <span key={`${h.nodeId}-${i}`} className={`rounded border px-2 py-1 font-mono text-2xs ${i === 0 ? 'border-accent text-accent' : 'border-line text-fg'}`}>
                      [{i}] {h.nodeId} {h.dist}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted">Array order of the min-heap. Index 0 is the smallest tentative distance. Entries already settled are skipped when they come out.</p>
            </Panel>

            <Panel title={`Visited nodes (${current.visited.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {current.visited.map((id) => (
                  <Tag key={id} color="#3fb68b">
                    {id}
                  </Tag>
                ))}
              </div>
            </Panel>

            <Panel title="Tentative distances" flush>
              <div className="max-h-64 overflow-y-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th className="text-right">Distance</th>
                      <th>Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(current.distances)
                      .filter((id) => current.distances[id] !== null)
                      .sort((a, b) => current.distances[a] - current.distances[b])
                      .map((id) => (
                        <tr key={id}>
                          <td className="font-mono text-xs">{id}</td>
                          <td className="text-right font-mono">{current.distances[id]}</td>
                          <td className="font-mono text-xs text-muted">{current.previous[id] || 'source'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}

        {finished && route && route.found && (
          <Panel title="Final shortest path">
            <p className="break-words font-mono text-xs leading-5 text-ok">{pathString(route.path)}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted">Distance</dt>
                <dd className="font-mono text-fg">{fmtKm(route.totalDistance)}</dd>
              </div>
              <div>
                <dt className="text-muted">Time</dt>
                <dd className="font-mono text-fg">{fmtMin(route.estimatedTime)}</dd>
              </div>
              <div>
                <dt className="text-muted">Nodes visited</dt>
                <dd className="font-mono text-fg">{route.visitedNodes.length}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">The path was rebuilt with a stack: pushed {route.stackTrace.pushed.join(', ')}, then popped in reverse.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
