import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import ReportEmergencyModal from '../components/ReportEmergencyModal';
import MissionPanel from '../components/MissionPanel';
import { Button, ConfirmModal, Empty, ErrorNote, Modal, PageHeader, Panel, SeverityTag, Spinner, StatusTag } from '../components/ui';
import { SEVERITIES } from '../utils/constants';
import { fmtDateTime, fmtTime, label } from '../utils/format';

function Detail({ k, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-fg">{children}</span>
    </div>
  );
}

function EmergencyDetail({ id, onClose, onChanged }) {
  const { live } = useLive();
  const toasts = useToasts();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = live ? (live.emergencies.find((e) => e.id === id) || {}).status : null;
  const load = useCallback(() => {
    api
      .get(`/emergencies/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);
  useEffect(load, [load, status]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.del(`/emergencies/${id}`);
      toasts.success('Emergency cancelled', `${id} was removed from the active list.`);
      setConfirm(false);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const e = data && data.emergency;
  const active = e && !['COMPLETED', 'CANCELLED'].includes(e.status);
  const missionActive = data && data.mission && live && live.missions.some((m) => m.id === data.mission.id);

  return (
    <>
      <Modal
        title={e ? `Emergency ${e.id}` : 'Emergency'}
        onClose={onClose}
        width="max-w-2xl"
        footer={
          e && active ? (
            <>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <XCircle size={15} /> Cancel emergency
              </Button>
              {e.status === 'PENDING' && (
                <>
                  <Button onClick={() => setEditing(true)}>
                    <Pencil size={15} /> Edit
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/dispatch')}>
                    Open in dispatch center
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )
        }
      >
        <ErrorNote className="mb-3">{error}</ErrorNote>
        {!e && !error && <Spinner />}
        {e && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <SeverityTag severity={e.severity} />
                <StatusTag status={e.status} />
              </div>
              {data.queuePosition && <Detail k="Queue position">{data.queuePosition}</Detail>}
              <Detail k="Type">{label(e.type)}</Detail>
              <Detail k="Location">{e.locationName}</Detail>
              <Detail k="Priority">{e.priority}</Detail>
              <Detail k="Required equipment">{e.requiredEquipment}</Detail>
              <Detail k="Required specialty">{label(e.requiredSpecialty)}</Detail>
              <Detail k="Ambulance">{e.assignedAmbulanceId || 'Not assigned'}</Detail>
              <Detail k="Reported by">{e.reportedBy}</Detail>
              <Detail k="Reported">{fmtDateTime(e.createdAt)}</Detail>
              {e.completedAt && <Detail k="Closed">{fmtDateTime(e.completedAt)}</Detail>}
              {e.description && <p className="mt-3 rounded border border-line bg-ink-900 p-3 text-sm text-muted">{e.description}</p>}
            </div>
            <div>
              {missionActive ? (
                <MissionPanel missionId={data.mission.id} onChanged={load} />
              ) : data.mission ? (
                <div className="text-sm text-muted">
                  <div className="panel-title mb-2">Mission</div>
                  <Detail k="Mission">{data.mission.id}</Detail>
                  <Detail k="Status">{label(data.mission.status)}</Detail>
                  {data.mission.hospitalName && <Detail k="Hospital">{data.mission.hospitalName}</Detail>}
                  {data.mission.responseTime !== null && data.mission.responseTime !== undefined && <Detail k="Response time">{data.mission.responseTime} min</Detail>}
                </div>
              ) : (
                <p className="text-sm text-muted">No ambulance has been dispatched yet.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
      {editing && e && (
        <ReportEmergencyModal
          emergency={e}
          onClose={() => setEditing(false)}
          onCreated={() => {
            load();
            onChanged();
          }}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={`Cancel ${id}?`}
          message={e && e.status !== 'PENDING' ? 'The ambulance will be released at its current position and the mission cancelled.' : 'The emergency will be removed from the priority queue.'}
          confirmLabel="Cancel emergency"
          danger
          loading={busy}
          onConfirm={cancel}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}

export default function Emergencies() {
  const { live } = useLive();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: 'ACTIVE', severity: '', q: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [report, setReport] = useState(false);
  const focus = params.get('focus');

  const signature = live ? live.emergencies.map((e) => `${e.id}${e.status}${e.severity}`).join('|') + live.kpis.totalEmergencies + live.kpis.completedMissions : '';

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.severity) qs.set('severity', filters.severity);
    if (filters.q.trim()) qs.set('q', filters.q.trim());
    api
      .get(`/emergencies?${qs.toString()}`)
      .then((res) => {
        setRows(res.emergencies);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [filters]);

  useEffect(load, [load, signature]);

  const statuses = useMemo(() => ['ACTIVE', '', 'PENDING', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED', 'CANCELLED'], []);
  const close = () => setParams({});

  return (
    <div>
      <PageHeader
        title="Emergencies"
        subtitle="Every reported emergency, stored in the database. New reports enter the priority queue immediately."
        actions={
          <>
            <Link to="/data-structures/priority-queue" className="btn btn-secondary hover:no-underline">
              View priority queue
            </Link>
            <Button variant="primary" onClick={() => setReport(true)}>
              <Plus size={16} /> Report new emergency
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="em-search">
            Search
          </label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-faint" />
            <input id="em-search" className="input pl-9" placeholder="ID, type, ambulance or description" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="em-status">
            Status
          </label>
          <select id="em-status" className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === 'ACTIVE' ? 'Active' : s === '' ? 'All' : label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="em-sev">
            Severity
          </label>
          <select id="em-sev" className="input" value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}>
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorNote className="mb-4">{error}</ErrorNote>
      <Panel flush>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty title="No emergencies match">Change the filters or report a new emergency.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Equipment</th>
                  <th>Specialty</th>
                  <th>Status</th>
                  <th>Ambulance</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="cursor-pointer" onClick={() => setParams({ focus: e.id })}>
                    <td className="font-mono">{e.id}</td>
                    <td>
                      <SeverityTag severity={e.severity} />
                    </td>
                    <td>{label(e.type)}</td>
                    <td>{e.locationName}</td>
                    <td className="font-mono text-xs">{e.requiredEquipment}</td>
                    <td className="text-xs">{label(e.requiredSpecialty)}</td>
                    <td>
                      <StatusTag status={e.status} />
                    </td>
                    <td className="font-mono">{e.assignedAmbulanceId || 'n/a'}</td>
                    <td className="font-mono text-xs text-muted">{fmtTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {report && <ReportEmergencyModal onClose={() => setReport(false)} onCreated={load} />}
      {focus && <EmergencyDetail id={focus} onClose={close} onChanged={load} />}
    </div>
  );
}
