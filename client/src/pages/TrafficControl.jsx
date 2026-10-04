import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import CityMap from '../components/CityMap';
import { toLatLon } from '../utils/geo';
import { TrafficTag } from '../components/NodeDetails';
import { Button, Empty, ErrorNote, Field, PageHeader, Panel, Select, Spinner, Tag } from '../components/ui';
import { NODE_TYPES, TRAFFIC_LEVELS, TRAFFIC_LABEL, TRAFFIC_MULTIPLIER } from '../utils/constants';
import { clsx, fmtKm, fmtMin, fmtTime, label } from '../utils/format';

const EVENT_COLOR = { TRAFFIC_CHANGE: '#e0a93a', ROAD_CLOSED: '#e5484d', ROAD_REOPENED: '#3fb68b', REROUTE: '#4aa3df', UNREACHABLE: '#e5484d' };

function RoadsTab() {
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [closedOnly, setClosedOnly] = useState(false);
  const [busy, setBusy] = useState(null);

  const signature = live ? live.roads.map((r) => `${r.trafficLevel}${r.isClosed ? 'x' : ''}`).join('') + live.notifications.length : '';
  const load = useCallback(() => {
    api
      .get('/traffic')
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load, signature]);

  const act = async (roadId, call) => {
    setBusy(roadId);
    try {
      await call();
      await refresh();
      load();
    } catch (err) {
      toasts.error('Road update failed', err.message);
    } finally {
      setBusy(null);
    }
  };

  const applyPreset = async (id) => {
    setBusy('preset');
    try {
      const res = await api.post('/traffic/preset', { preset: id });
      toasts.success(res.label, `${res.changedRoads} road${res.changedRoads === 1 ? '' : 's'} changed.`);
      await refresh();
      load();
    } catch (err) {
      toasts.error('Preset failed', err.message);
    } finally {
      setBusy(null);
    }
  };

  const exportEvents = () => api.download('/traffic/export.csv', 'traffic-events.csv').catch((err) => toasts.error('Export failed', err.message));

  const roads = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.roads.filter((r) => {
      if (closedOnly && !r.isClosed) return false;
      if (level && r.trafficLevel !== level) return false;
      if (!needle) return true;
      return `${r.id} ${r.sourceName} ${r.destinationName}`.toLowerCase().includes(needle);
    });
  }, [data, q, level, closedOnly]);

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-line bg-ink-800 px-3 py-2.5">
          <span className="panel-title mr-2">Traffic pattern</span>
          <Button size="sm" disabled={busy === 'preset'} onClick={() => applyPreset('MORNING_PEAK')}>
            Morning peak
          </Button>
          <Button size="sm" disabled={busy === 'preset'} onClick={() => applyPreset('EVENING_PEAK')}>
            Evening peak
          </Button>
          <Button size="sm" disabled={busy === 'preset'} onClick={() => applyPreset('CLEAR')}>
            Clear all traffic
          </Button>
          <span className="text-xs text-muted">Peaks slow the roads around busy hubs and reroute ambulances that are affected.</span>
        </div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="label" htmlFor="road-search">
              Search roads
            </label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-faint" />
              <input id="road-search" className="input pl-9" placeholder="Road ID or place" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="road-level">
              Traffic
            </label>
            <select id="road-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {TRAFFIC_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {TRAFFIC_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-muted">
            <input type="checkbox" checked={closedOnly} onChange={(e) => setClosedOnly(e.target.checked)} /> Closed only
          </label>
        </div>
        <ErrorNote className="mb-3">{error}</ErrorNote>
        <Panel flush>
          {roads.length === 0 ? (
            <Empty title="No roads match" />
          ) : (
            <div className="max-h-[68vh] overflow-auto">
              <table className="tbl">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>Road</th>
                    <th>From</th>
                    <th>To</th>
                    <th className="text-right">Distance</th>
                    <th className="text-right">Normal</th>
                    <th className="text-right">Current</th>
                    <th>Traffic</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roads.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono">{r.id}</td>
                      <td>{r.sourceName}</td>
                      <td>{r.destinationName}</td>
                      <td className="whitespace-nowrap text-right font-mono">{fmtKm(r.distance)}</td>
                      <td className="whitespace-nowrap text-right font-mono">{fmtMin(r.normalTravelTime)}</td>
                      <td className="whitespace-nowrap text-right font-mono">{r.isClosed ? 'closed' : fmtMin(r.currentTravelTime)}</td>
                      <td>
                        <TrafficTag level={r.trafficLevel} closed={r.isClosed} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {TRAFFIC_LEVELS.map((l) => (
                            <Button
                              key={l}
                              size="sm"
                              disabled={busy === r.id || r.trafficLevel === l}
                              onClick={() => act(r.id, () => api.put(`/roads/${r.id}/traffic`, { level: l }))}
                              title={`${TRAFFIC_LABEL[l]}, x${TRAFFIC_MULTIPLIER[l]}`}
                            >
                              {l === 'LOW' ? 'Set normal' : l === 'MODERATE' ? 'Set moderate' : l === 'HIGH' ? 'Set heavy' : 'Set severe'}
                            </Button>
                          ))}
                          {r.isClosed ? (
                            <Button size="sm" variant="ok" disabled={busy === r.id} onClick={() => act(r.id, () => api.put(`/roads/${r.id}/reopen`))}>
                              Reopen road
                            </Button>
                          ) : (
                            <Button size="sm" variant="danger" disabled={busy === r.id} onClick={() => act(r.id, () => api.put(`/roads/${r.id}/close`))}>
                              Close road
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <p className="mt-3 text-xs text-muted">Multipliers on normal travel time: normal x1.0, moderate x1.4, heavy x2.0, severe x3.0. Changes reroute any ambulance whose remaining route uses the road.</p>
      </div>

      <Panel title="Recent traffic events" flush className="self-start" actions={<Button size="sm" onClick={exportEvents}>Export CSV</Button>}>
        {data.events.length === 0 ? (
          <Empty title="No events yet">Traffic changes, closures and reroutes are logged here.</Empty>
        ) : (
          <ul className="max-h-[68vh] overflow-y-auto">
            {data.events.map((e) => (
              <li key={e.id} className="border-b border-line px-4 py-2.5 text-xs last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <Tag color={EVENT_COLOR[e.type]}>{label(e.type)}</Tag>
                  <span className="font-mono text-faint">{fmtTime(e.createdAt)}</span>
                </div>
                <div className="mt-1 text-muted">
                  {e.roadId && <span className="font-mono text-fg">{e.roadId}</span>}
                  {e.type === 'TRAFFIC_CHANGE' && ` ${e.oldLevel} to ${e.newLevel}`}
                  {e.details && <div>{e.details}</div>}
                  {e.type === 'REROUTE' && e.etaAfter !== null && <div>ETA {e.etaBefore === null ? 'blocked' : fmtMin(e.etaBefore)} to {fmtMin(e.etaAfter)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function GraphTab() {
  const { graph, live, refresh } = useLive();
  const toasts = useToasts();
  const [node, setNode] = useState({ id: '', name: '', type: 'JUNCTION', x: '', y: '' });
  const [road, setRoad] = useState({ source: '', destination: '', distance: '', normalTravelTime: '' });
  const [nodeError, setNodeError] = useState('');
  const [roadError, setRoadError] = useState('');
  const [busy, setBusy] = useState('');

  const sorted = useMemo(() => (graph ? graph.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)) : []), [graph]);
  const suggested = useMemo(() => {
    if (!graph || !road.source || !road.destination || road.source === road.destination) return null;
    const a = graph.nodes.find((n) => n.id === road.source);
    const b = graph.nodes.find((n) => n.id === road.destination);
    if (!a || !b) return null;
    return Math.max(0.4, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.012 * 10) / 10);
  }, [graph, road.source, road.destination]);

  if (!graph || !live) return <Spinner />;

  const submitNode = async (e) => {
    e.preventDefault();
    setBusy('node');
    setNodeError('');
    try {
      const res = await api.post('/graph/nodes', { ...node, x: Number(node.x), y: Number(node.y) });
      toasts.success('Node added', `The map now has ${res.stats.vertices} nodes.`);
      setNode({ id: '', name: '', type: 'JUNCTION', x: '', y: '' });
      await refresh();
    } catch (err) {
      setNodeError(err.message);
    } finally {
      setBusy('');
    }
  };

  const submitRoad = async (e) => {
    e.preventDefault();
    setBusy('road');
    setRoadError('');
    try {
      const body = { source: road.source, destination: road.destination, distance: Number(road.distance) };
      if (road.normalTravelTime !== '') body.normalTravelTime = Number(road.normalTravelTime);
      const res = await api.post('/graph/roads', body);
      toasts.success('Road added', `The map now has ${res.stats.edges} roads in ${res.stats.components} connected area${res.stats.components === 1 ? '' : 's'}.`);
      setRoad({ source: '', destination: '', distance: '', normalTravelTime: '' });
      await refresh();
    } catch (err) {
      setRoadError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel title="Click the map to pick node coordinates" flush className="overflow-hidden self-start">
        <div className="aspect-[1000/620] w-full">
          <CityMap graph={graph} live={live} showAmbulances={false} showEmergencies={false} onMapClick={({ x, y }) => setNode((n) => ({ ...n, x, y }))} marker={node.x !== '' && node.y !== '' ? { x: Number(node.x), y: Number(node.y) } : null} />
        </div>
        <div className="border-t border-line px-4 py-2 text-xs text-muted">
          {graph.nodes.length} nodes, {graph.roads.length} roads. The map canvas is 1000 by 620 units.
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Add node">
          <form onSubmit={submitNode} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Node ID">
                <input className="input font-mono uppercase" value={node.id} maxLength={24} onChange={(e) => setNode({ ...node, id: e.target.value })} />
              </Field>
              <Field label="Type">
                <select className="input" value={node.type} onChange={(e) => setNode({ ...node, type: e.target.value })}>
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Name">
              <input className="input" value={node.name} maxLength={60} onChange={(e) => setNode({ ...node, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="X">
                <input className="input font-mono" type="number" min="0" max="1000" value={node.x} onChange={(e) => setNode({ ...node, x: e.target.value })} />
              </Field>
              <Field label="Y">
                <input className="input font-mono" type="number" min="0" max="620" value={node.y} onChange={(e) => setNode({ ...node, y: e.target.value })} />
              </Field>
            </div>
            {node.x !== '' && node.y !== '' && Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)) && (
              <p className="text-xs text-muted">
                Location on the map: {toLatLon(Number(node.x), Number(node.y)).lat.toFixed(4)} N, {toLatLon(Number(node.x), Number(node.y)).lon.toFixed(4)} E
              </p>
            )}
            <ErrorNote>{nodeError}</ErrorNote>
            <Button variant="primary" type="submit" loading={busy === 'node'}>
              Add node
            </Button>
          </form>
        </Panel>

        <Panel title="Add road">
          <form onSubmit={submitRoad} className="space-y-3" noValidate>
            <Field label="From">
              <Select className="input" value={road.source} onChange={(e) => setRoad({ ...road, source: e.target.value })} aria-label="Road source">
                <option value="">Select a node</option>
                {sorted.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To">
              <Select className="input" value={road.destination} onChange={(e) => setRoad({ ...road, destination: e.target.value })} aria-label="Road destination">
                <option value="">Select a node</option>
                {sorted.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Distance (km)" hint={suggested ? `Suggested ${suggested} km` : undefined}>
                <input className="input font-mono" type="number" step="0.1" min="0.1" value={road.distance} onChange={(e) => setRoad({ ...road, distance: e.target.value })} />
              </Field>
              <Field label="Travel time (min)" hint="Blank uses 40 km/h">
                <input className="input font-mono" type="number" step="0.1" min="0.1" value={road.normalTravelTime} onChange={(e) => setRoad({ ...road, normalTravelTime: e.target.value })} />
              </Field>
            </div>
            <ErrorNote>{roadError}</ErrorNote>
            <Button variant="primary" type="submit" loading={busy === 'road'}>
              Add road
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export default function TrafficControl() {
  const [tab, setTab] = useState('roads');
  return (
    <div>
      <PageHeader title="Traffic Control" subtitle="Change traffic, close roads and edit the map. Ambulances already moving are rerouted from their current position." />
      <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
        {[
          ['roads', 'Roads'],
          ['graph', 'Graph editor'],
        ].map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx('-mb-px border-b-2 px-4 py-2 text-sm', tab === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg')}
          >
            {text}
          </button>
        ))}
      </div>
      {tab === 'roads' ? <RoadsTab /> : <GraphTab />}
    </div>
  );
}
