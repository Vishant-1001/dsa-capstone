import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Plus, Send } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import CityMap, { MapLegend } from '../components/CityMap';
import MissionPanel from '../components/MissionPanel';
import ReportEmergencyModal from '../components/ReportEmergencyModal';
import SimControls from '../components/SimControls';
import { Button, Empty, ErrorNote, PageHeader, Panel, SeverityTag, Spinner, StatusTag, Tag } from '../components/ui';
import { fmtKm, fmtMin, label, pathString } from '../utils/format';

function Step({ n, title, ids, total }) {
  return (
    <li className="flex items-start gap-3 text-xs">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink-600 font-mono text-2xs text-muted">{n}</span>
      <div className="min-w-0">
        <div className="text-fg">
          {title} <span className="font-mono text-muted">({ids.length}{total !== undefined ? ` of ${total}` : ''})</span>
        </div>
        <div className="font-mono text-faint">{ids.length ? ids.join(', ') : 'none'}</div>
      </div>
    </li>
  );
}

function Recommendation({ rec, emergency, onDispatch, busy, error, override, setOverride }) {
  const { nodeById } = useLive();
  const sel = rec.selection;
  const p = sel.pipeline;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base">{emergency.id}</span>
          <SeverityTag severity={emergency.severity} />
          <Tag>{label(emergency.type)}</Tag>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-muted">Location</dt>
            <dd className="text-fg">{emergency.locationName}</dd>
          </div>
          <div>
            <dt className="text-muted">Queue position</dt>
            <dd className="font-mono text-fg">{rec.queuePosition}</dd>
          </div>
          <div>
            <dt className="text-muted">Required equipment</dt>
            <dd className="text-fg">{emergency.requiredEquipment}</dd>
          </div>
          <div>
            <dt className="text-muted">Hospital specialty</dt>
            <dd className="text-fg">{label(emergency.requiredSpecialty)}</dd>
          </div>
        </dl>
        {emergency.description && <p className="mt-2 text-xs text-muted">{emergency.description}</p>}
      </div>

      <div>
        <div className="panel-title mb-2">Selection steps</div>
        <ol className="space-y-2">
          <Step n={1} title="Available ambulances" ids={p.available} total={p.total} />
          <Step n={2} title={`Filtered by ${emergency.requiredEquipment} equipment`} ids={p.equipmentMatch} />
          <Step n={3} title="Dijkstra route found" ids={p.reachable} />
        </ol>
      </div>

      {sel.candidates.length > 0 && (
        <div>
          <div className="panel-title mb-2">Candidate routes</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Unit</th>
                <th>ETA</th>
                <th>Distance</th>
                <th>Visited</th>
              </tr>
            </thead>
            <tbody>
              {sel.candidates.map((c) => {
                const best = sel.selected && sel.selected.ambulanceId === c.ambulanceId;
                return (
                  <tr key={c.ambulanceId} className={best ? 'bg-accent-soft/40' : ''}>
                    <td>
                      <span className="font-mono">{c.ambulanceId}</span> <span className="text-2xs text-muted">{c.equipment}</span>
                      {best && <div className="mt-0.5"><Tag color="#4aa3df">Recommended</Tag></div>}
                    </td>
                    <td className="font-mono">{c.reachable ? fmtMin(c.travelTime) : 'none'}</td>
                    <td className="font-mono">{c.reachable ? fmtKm(c.distance) : 'n/a'}</td>
                    <td className="font-mono">{c.reachable ? c.visitedNodes.length : 'n/a'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sel.selected ? (
        <div className="rounded border border-accent/40 bg-accent-soft/40 p-3">
          <div className="panel-title mb-1">Recommended ambulance</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl text-fg">{sel.selected.ambulanceId}</span>
            <span className="text-sm text-muted">{sel.selected.equipment}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted">ETA</div>
              <div className="font-mono text-fg">{fmtMin(sel.selected.travelTime)}</div>
            </div>
            <div>
              <div className="text-muted">Distance</div>
              <div className="font-mono text-fg">{fmtKm(sel.selected.distance)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted">Algorithm: Dijkstra on current travel times</div>
          <div className="mt-1 break-words font-mono text-2xs leading-4 text-accent">{pathString(sel.selected.path, nodeById)}</div>
          <p className="mt-2 text-xs text-muted">{sel.explanation}</p>
        </div>
      ) : (
        <ErrorNote>{sel.explanation}</ErrorNote>
      )}

      {rec.blockedBy && (
        <div className="rounded border border-warn/50 bg-warn/10 p-3 text-xs text-yellow-100">
          <b>{rec.blockedBy.emergencyId}</b> ({rec.blockedBy.severity}) is ahead in the queue and can be dispatched now. Dispatch it first, or override the order.
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override the queue order
          </label>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <Button variant="primary" className="w-full py-3 text-base" onClick={onDispatch} loading={busy} disabled={!sel.selected || (rec.blockedBy && !override)}>
        <Send size={16} /> DISPATCH
      </Button>
    </div>
  );
}

export default function DispatchCenter() {
  const { live, graph, refresh } = useLive();
  const toasts = useToasts();
  const [selectedId, setSelectedId] = useState(null);
  const [missionId, setMissionId] = useState(null);
  const [rec, setRec] = useState(null);
  const [recError, setRecError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  const [report, setReport] = useState(false);

  const queue = live ? live.queue.ordered : [];
  const head = live ? live.queue.head : null;

  // Keep a sensible selection: the head of the queue unless a mission is open.
  useEffect(() => {
    if (!live) return;
    if (selectedId && queue.some((e) => e.id === selectedId)) return;
    setSelectedId(head);
  }, [head, queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const signature = useMemo(() => {
    if (!live) return '';
    return live.ambulances.map((a) => `${a.id}${a.status}${a.nodeId}`).join('|') + live.roads.map((r) => `${r.trafficLevel}${r.isClosed ? 'x' : ''}`).join('') + live.queue.ordered.map((e) => e.id).join(',');
  }, [live]);

  useEffect(() => {
    if (!selectedId) {
      setRec(null);
      return undefined;
    }
    let cancelled = false;
    api
      .get(`/dispatch/${selectedId}/recommendation`)
      .then((res) => {
        if (!cancelled) {
          setRec(res.recommendation);
          setRecError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRec(null);
          setRecError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, signature]);

  useEffect(() => setOverride(false), [selectedId]);

  const emergency = live && selectedId ? live.queue.ordered.find((e) => e.id === selectedId) : null;
  const activeMissions = live ? live.missions : [];

  const dispatch = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/dispatch/${selectedId}`, { override });
      setMissionId(res.mission.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [selectedId, override, refresh]);

  const dispatchNext = async () => {
    try {
      const res = await api.post('/dispatch/next');
      setMissionId(res.mission.id);
      await refresh();
    } catch (err) {
      toasts.error('Nothing was dispatched', err.message);
    }
  };

  const routes = useMemo(() => {
    if (!rec) return [];
    return rec.selection.candidates
      .filter((c) => c.reachable)
      .map((c) => {
        const best = rec.selection.selected && rec.selection.selected.ambulanceId === c.ambulanceId;
        return { key: `cand-${c.ambulanceId}`, path: c.path, color: best ? '#4aa3df' : '#8593a3', width: best ? 5 : 3, dashed: best ? null : '6 6', opacity: best ? 0.95 : 0.8 };
      })
      .sort((a, b) => (a.width < b.width ? -1 : 1));
  }, [rec]);

  if (!live || !graph) return <Spinner text="Loading dispatch data" />;

  const showMission = missionId && activeMissions.some((m) => m.id === missionId);

  return (
    <div>
      <PageHeader
        title="Dispatch Center"
        subtitle="The queue is ordered by priority, then arrival. The recommendation compares Dijkstra travel times from every suitable ambulance."
        actions={
          <>
            <SimControls />
            <Button variant="primary" onClick={() => setReport(true)}>
              <Plus size={16} /> Report emergency
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_23rem]">
        <div className="space-y-4">
          <Panel
            title={`Priority queue (${queue.length})`}
            flush
            actions={
              <Button size="sm" onClick={dispatchNext} disabled={queue.length === 0} title="Dispatch the highest priority emergency that has a suitable ambulance">
                Dispatch next <ArrowRight size={13} />
              </Button>
            }
          >
            {queue.length === 0 ? (
              <Empty title="The queue is empty">New emergencies appear here, highest priority first.</Empty>
            ) : (
              <ol>
                {queue.map((e, i) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(e.id);
                        setMissionId(null);
                      }}
                      className={`w-full border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-ink-700 ${e.id === selectedId && !showMission ? 'bg-ink-700' : ''}`}
                      style={e.id === selectedId && !showMission ? { boxShadow: 'inset 3px 0 0 #4aa3df' } : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-faint">#{i + 1}</span>
                          <span className="font-mono text-sm">{e.id}</span>
                          <SeverityTag severity={e.severity} />
                        </div>
                        {i === 0 && <Tag color="#4aa3df">Next</Tag>}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {label(e.type)} at {e.locationName}
                      </div>
                      <div className="mt-0.5 text-2xs text-faint">
                        Needs {e.requiredEquipment}, priority {e.priority}
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title={`Active missions (${activeMissions.length})`} flush>
            {activeMissions.length === 0 ? (
              <Empty title="No active missions" />
            ) : (
              <ul>
                {activeMissions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMissionId(m.id)}
                      className={`flex w-full items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-ink-700 ${m.id === missionId ? 'bg-ink-700' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{m.ambulanceId}</span>
                        <span className="font-mono text-xs text-muted">{m.emergencyId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusTag status={m.status} />
                        {m.movement && <span className="font-mono text-xs text-fg">{m.movement.blocked ? 'blocked' : fmtMin(m.movement.etaMinutes)}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel flush className="overflow-hidden self-start">
          <div className="aspect-[1000/620] w-full">
            <CityMap graph={graph} live={live} routes={showMission ? [] : routes} selectedNodeId={emergency && !showMission ? emergency.nodeId : null} />
          </div>
          <div className="border-t border-line p-3">
            <MapLegend className="sm:grid-cols-4" />
          </div>
        </Panel>

        <Panel title={showMission ? 'Mission' : 'Recommended ambulance'}>
          {showMission ? (
            <MissionPanel missionId={missionId} />
          ) : !selectedId ? (
            <Empty title="No emergency selected">Report an emergency to see the recommended ambulance.</Empty>
          ) : recError ? (
            <ErrorNote>{recError}</ErrorNote>
          ) : !rec || !emergency ? (
            <Spinner text="Calculating routes" />
          ) : (
            <Recommendation rec={rec} emergency={emergency} onDispatch={dispatch} busy={busy} error={error} override={override} setOverride={setOverride} />
          )}
        </Panel>
      </div>

      {report && <ReportEmergencyModal onClose={() => setReport(false)} onCreated={(res) => setSelectedId(res.emergency.id)} />}
    </div>
  );
}
