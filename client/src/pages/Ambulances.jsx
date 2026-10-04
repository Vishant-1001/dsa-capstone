import { useCallback, useEffect, useState } from 'react';
import { Eye, Plus, Pencil, Power, Undo2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import MissionPanel from '../components/MissionPanel';
import { Button, Empty, ErrorNote, Field, Modal, PageHeader, Panel, Select, Spinner, StatusTag, Tag } from '../components/ui';
import { EQUIPMENT } from '../utils/constants';
import { fmtKm, fmtMin } from '../utils/format';

function AmbulanceForm({ ambulance, onClose, onSaved }) {
  const { graph } = useLive();
  const editing = Boolean(ambulance);
  const [form, setForm] = useState({
    id: ambulance ? ambulance.id : '',
    name: ambulance ? ambulance.name : '',
    equipment: ambulance ? ambulance.equipment : 'BASIC',
    nodeId: ambulance ? ambulance.nodeId : '',
    homeStationId: ambulance && ambulance.homeStationId ? ambulance.homeStationId : '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stations = graph ? graph.nodes.filter((n) => n.type === 'STATION') : [];
  const nodes = graph ? graph.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
  const locked = editing && !['AVAILABLE', 'OFFLINE'].includes(ambulance.status);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editing) {
        const body = { name: form.name, homeStationId: form.homeStationId || undefined };
        if (!locked) {
          body.equipment = form.equipment;
          body.nodeId = form.nodeId;
        }
        await api.put(`/ambulances/${ambulance.id}`, body);
      } else {
        await api.post('/ambulances', { ...form, homeStationId: form.homeStationId || undefined });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${ambulance.id}` : 'Add ambulance'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="amb-form" loading={busy}>
            {editing ? 'Save changes' : 'Add ambulance'}
          </Button>
        </>
      }
    >
      <form id="amb-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ambulance ID" hint="Letters and digits, for example A9">
            <input className="input font-mono uppercase" value={form.id} disabled={editing} maxLength={24} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          </Field>
          <Field label="Name">
            <input className="input" value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unit name" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Equipment" hint={locked ? 'Locked while on a mission' : undefined}>
            <select className="input" value={form.equipment} disabled={locked} onChange={(e) => setForm({ ...form, equipment: e.target.value })}>
              {EQUIPMENT.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Home station">
            <select className="input" value={form.homeStationId} onChange={(e) => setForm({ ...form, homeStationId: e.target.value })}>
              <option value="">None</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Current location" hint={locked ? 'Locked while on a mission' : undefined}>
          <Select className="input" value={form.nodeId} disabled={locked} onChange={(e) => setForm({ ...form, nodeId: e.target.value })} aria-label="Current location">
            <option value="">Select a location</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.id})
              </option>
            ))}
          </Select>
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  );
}

export default function Ambulances() {
  const { isAdmin } = useAuth();
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // null | 'new' | ambulance
  const [viewMission, setViewMission] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const signature = live ? live.ambulances.map((a) => `${a.id}${a.status}${a.nodeId}${Math.round(a.distanceTravelled)}`).join('|') : '';
  const load = useCallback(() => {
    api
      .get('/ambulances')
      .then((res) => {
        setRows(res.ambulances);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load, signature]);

  const run = async (id, fn, okTitle) => {
    setBusyId(id);
    try {
      await fn();
      if (okTitle) toasts.success(okTitle);
      await refresh();
      load();
    } catch (err) {
      toasts.error('Action failed', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const liveById = {};
  if (live) live.ambulances.forEach((a) => { liveById[a.id] = a; });

  return (
    <div>
      <PageHeader
        title="Ambulances"
        subtitle="Fleet status from the database. Status changes made here are saved and used by dispatch immediately."
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> Add ambulance
            </Button>
          )
        }
      />
      <ErrorNote className="mb-4">{error}</ErrorNote>
      <Panel flush>
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty title="No ambulances" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Equipment</th>
                  <th>Location</th>
                  <th>Home station</th>
                  <th>Mission</th>
                  <th className="text-right">Travelled</th>
                  <th className="text-right">Missions</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const l = liveById[a.id];
                  const busy = busyId === a.id;
                  const away = a.homeStationId && a.nodeId !== a.homeStationId;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="font-mono">{a.id}</div>
                        <div className="text-2xs text-faint">{a.name}</div>
                      </td>
                      <td>
                        <StatusTag status={a.status} />
                        {l && l.movement && !l.movement.blocked && <div className="mt-0.5 font-mono text-2xs text-muted">ETA {fmtMin(l.movement.etaMinutes)}</div>}
                      </td>
                      <td>
                        <Tag color="#4aa3df">{a.equipment}</Tag>
                      </td>
                      <td>{a.locationName}</td>
                      <td className="text-muted">{a.homeStationName || 'n/a'}</td>
                      <td className="font-mono">{a.currentMissionId || 'n/a'}</td>
                      <td className="text-right font-mono">{fmtKm(a.distanceTravelled)}</td>
                      <td className="text-right font-mono">{a.completedMissions}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {a.currentMissionId && (
                            <Button size="sm" onClick={() => setViewMission(a.currentMissionId)}>
                              <Eye size={13} /> View mission
                            </Button>
                          )}
                          {a.status === 'AVAILABLE' && away && (
                            <Button size="sm" disabled={busy} onClick={() => run(a.id, () => api.post(`/ambulances/${a.id}/return`))}>
                              <Undo2 size={13} /> Return
                            </Button>
                          )}
                          {isAdmin && a.status === 'AVAILABLE' && (
                            <Button size="sm" disabled={busy} onClick={() => run(a.id, () => api.put(`/ambulances/${a.id}`, { status: 'OFFLINE' }), `${a.id} set offline`)}>
                              <Power size={13} /> Set offline
                            </Button>
                          )}
                          {isAdmin && a.status === 'OFFLINE' && (
                            <Button size="sm" variant="ok" disabled={busy} onClick={() => run(a.id, () => api.put(`/ambulances/${a.id}`, { status: 'AVAILABLE' }), `${a.id} set available`)}>
                              <Power size={13} /> Set available
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" onClick={() => setForm(a)} aria-label={`Edit ${a.id}`}>
                              <Pencil size={13} /> Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 text-xs text-muted">Equipment rule: BASIC calls can use any unit. ALS, TRAUMA and PEDIATRIC calls need a unit with that equipment.</p>

      {form && <AmbulanceForm ambulance={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { refresh(); load(); }} />}
      {viewMission && (
        <Modal title={`Mission ${viewMission}`} onClose={() => setViewMission(null)} width="max-w-xl">
          <MissionPanel missionId={viewMission} />
        </Modal>
      )}
    </div>
  );
}
