import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { Button, Empty, ErrorNote, Modal, PageHeader, Panel, SeverityTag, Spinner, StatusTag } from '../components/ui';
import { SEVERITIES } from '../utils/constants';
import { fmtDateTime, fmtKm, fmtMin, label, pathString } from '../utils/format';

const SORTS = [
  ['dispatchedAt', 'Dispatched time'],
  ['completedAt', 'Completed time'],
  ['severity', 'Severity'],
  ['responseTime', 'Response time'],
  ['travelTime', 'Travel time'],
  ['distance', 'Distance'],
  ['id', 'Mission ID'],
  ['ambulance', 'Ambulance'],
  ['hospital', 'Hospital'],
];

function Row({ k, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-fg">{children}</span>
    </div>
  );
}

function MissionDetail({ id, onClose }) {
  const { nodeById } = useLive();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get(`/missions/${id}`)
      .then((res) => setM(res.mission))
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <Modal title={`Mission ${id}`} onClose={onClose} width="max-w-3xl" footer={<Button onClick={onClose}>Close</Button>}>
      <ErrorNote>{error}</ErrorNote>
      {!m && !error && <Spinner />}
      {m && (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <SeverityTag severity={m.severity} />
              <StatusTag status={m.status} />
            </div>
            <Row k="Emergency">
              {m.emergencyId}, {label(m.emergencyType)}
            </Row>
            <Row k="Location">{m.locationName}</Row>
            <Row k="Ambulance">{m.ambulanceId}</Row>
            <Row k="Hospital">{m.hospitalName || 'n/a'}</Row>
            <Row k="Response time">{fmtMin(m.responseTime)}</Row>
            <Row k="Travel time">{fmtMin(m.travelTime)}</Row>
            <Row k="Planned travel (first Dijkstra estimate)">{fmtMin((m.scenePlannedTime || 0) + (m.hospitalPlannedTime || 0))}</Row>
            <Row k="Actual travel (without 1 min turnout)">{m.travelTime === null ? 'n/a' : fmtMin(Math.max(0, m.travelTime - 1))}</Row>
            <Row k="Total distance">{fmtKm(m.totalDistance)}</Row>
            <Row k="Traffic delay">{fmtMin(m.trafficDelay)}</Row>
            <Row k="Reroutes">{m.rerouteCount}</Row>
            <Row k="Dispatched">{fmtDateTime(m.dispatchedAt)}</Row>
            <Row k="Completed">{fmtDateTime(m.completedAt)}</Row>
            <Row k="Dispatched by">{m.dispatchedBy}</Row>
          </div>
          <div className="space-y-4 text-sm">
            {m.sceneRoute && (
              <div>
                <div className="panel-title mb-1">Route to scene (planned)</div>
                <p className="font-mono text-xs leading-5 text-accent">{pathString(m.sceneRoute.path, nodeById)}</p>
                <p className="text-xs text-muted">
                  {fmtKm(m.sceneRoute.distance)}, {fmtMin(m.sceneRoute.time)}, {m.sceneRoute.visitedNodes.length} nodes visited
                </p>
              </div>
            )}
            {m.hospitalRoute && (
              <div>
                <div className="panel-title mb-1">Route to hospital (planned)</div>
                <p className="font-mono text-xs leading-5 text-ok">{pathString(m.hospitalRoute.path, nodeById)}</p>
                <p className="text-xs text-muted">
                  {fmtKm(m.hospitalRoute.distance)}, {fmtMin(m.hospitalRoute.time)}, {m.hospitalRoute.visitedNodes.length} nodes visited
                </p>
              </div>
            )}
            {m.selectionLog && (
              <div>
                <div className="panel-title mb-1">Why this ambulance</div>
                <p className="text-xs text-muted">{m.selectionLog.explanation}</p>
              </div>
            )}
            {m.hospitalLog && (
              <div>
                <div className="panel-title mb-1">Why this hospital</div>
                <p className="text-xs text-muted">{m.hospitalLog.explanation}</p>
              </div>
            )}
            {m.reroutes.length > 0 && (
              <div>
                <div className="panel-title mb-1">Reroutes</div>
                <ul className="space-y-1 text-xs text-muted">
                  {m.reroutes.map((r, i) => (
                    <li key={`${r.at}-${i}`} className="rounded border border-line bg-ink-900 px-2 py-1.5">
                      <span className="text-warn">
                        {r.leg === 'SCENE' ? 'To scene' : 'To hospital'}: ETA {r.etaBefore === null || r.etaBefore === undefined ? 'blocked' : fmtMin(r.etaBefore)} to {fmtMin(r.etaAfter)}
                      </span>
                      <div>{r.trigger}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function MissionHistory() {
  const { live } = useLive();
  const [filters, setFilters] = useState({ search: '', severity: '', status: 'COMPLETED', sort: 'dispatchedAt', dir: 'desc' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const version = live ? `${live.kpis.completedMissions}-${live.kpis.activeMissions}` : '';

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.keys(filters).forEach((k) => filters[k] && qs.set(k, filters[k]));
    const t = window.setTimeout(() => {
      api
        .get(`/missions?${qs.toString()}`)
        .then((res) => {
          setRows(res.missions);
          setError('');
        })
        .catch((err) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(t);
  }, [filters, version]);

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <PageHeader
        title="Mission History"
        subtitle="Every mission stored in the database. Times are simulation minutes."
        actions={
          <Button onClick={() => api.download('/missions/export.csv', 'missions.csv').catch((err) => setError(err.message))}>
            <Download size={15} /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="mh-search">
            Search
          </label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-faint" />
            <input id="mh-search" className="input pl-9" placeholder="Mission, emergency, ambulance, hospital or location" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="mh-status">
            Status
          </label>
          <select id="mh-status" className="input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="">All</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mh-sev">
            Severity
          </label>
          <select id="mh-sev" className="input" value={filters.severity} onChange={(e) => set({ severity: e.target.value })}>
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mh-sort">
            Sort by
          </label>
          <div className="flex gap-1">
            <select id="mh-sort" className="input" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
            <Button onClick={() => set({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })} aria-label={`Sort ${filters.dir === 'asc' ? 'descending' : 'ascending'}`} title={filters.dir === 'asc' ? 'Ascending' : 'Descending'}>
              {filters.dir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </Button>
          </div>
        </div>
      </div>

      <ErrorNote className="mb-4">{error}</ErrorNote>
      <Panel flush>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty title="No missions match">Completed missions are stored here after a patient is delivered.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Emergency</th>
                  <th>Ambulance</th>
                  <th>Hospital</th>
                  <th>Severity</th>
                  <th className="text-right">Response</th>
                  <th className="text-right">Travel</th>
                  <th className="text-right">Distance</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="cursor-pointer" onClick={() => setOpen(m.id)}>
                    <td className="font-mono">{m.id}</td>
                    <td className="font-mono">{m.emergencyId}</td>
                    <td className="font-mono">{m.ambulanceId}</td>
                    <td>{m.hospitalName || 'n/a'}</td>
                    <td>
                      <SeverityTag severity={m.severity} />
                    </td>
                    <td className="text-right font-mono">{m.responseTime === null ? 'n/a' : fmtMin(m.responseTime)}</td>
                    <td className="text-right font-mono">{m.travelTime === null ? 'n/a' : fmtMin(m.travelTime)}</td>
                    <td className="text-right font-mono">{m.totalDistance === null ? 'n/a' : fmtKm(m.totalDistance)}</td>
                    <td className="font-mono text-xs text-muted">{m.completedAt ? fmtDateTime(m.completedAt) : m.status === 'CANCELLED' ? 'Cancelled' : 'In progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {open && <MissionDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
