import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Pencil, Plus, Power } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button, Empty, ErrorNote, Field, Modal, PageHeader, Panel, Select, Spinner, StatusTag, Tag } from '../components/ui';
import { SPECIALTIES } from '../utils/constants';
import { label } from '../utils/format';

function BedBar({ available, total }) {
  const used = total > 0 ? ((total - available) / total) * 100 : 0;
  const color = available === 0 ? '#e5484d' : available <= 2 ? '#e0a93a' : '#3fb68b';
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-ink-600" role="img" aria-label={`${available} of ${total} beds available`}>
        <div className="h-full" style={{ width: `${used}%`, backgroundColor: color, opacity: 0.85 }} />
      </div>
    </div>
  );
}

function HospitalForm({ hospital, onClose, onSaved }) {
  const { graph, live } = useLive();
  const editing = Boolean(hospital);
  const [form, setForm] = useState({
    id: hospital ? hospital.id : '',
    name: hospital ? hospital.name : '',
    nodeId: hospital ? hospital.nodeId : '',
    totalBeds: hospital ? hospital.totalBeds : 20,
    availableBeds: hospital ? hospital.availableBeds : 20,
    specialties: hospital ? hospital.specialties : ['GENERAL'],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const used = live ? live.hospitals.map((h) => h.nodeId) : [];
  const freeNodes = graph ? graph.nodes.filter((n) => n.type === 'HOSPITAL' && !used.includes(n.id)) : [];

  const toggle = (s) =>
    setForm((f) => ({ ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/hospitals/${hospital.id}`, {
          name: form.name,
          totalBeds: Number(form.totalBeds),
          availableBeds: Number(form.availableBeds),
          specialties: form.specialties,
        });
      } else {
        await api.post('/hospitals', { ...form, totalBeds: Number(form.totalBeds), availableBeds: Number(form.availableBeds) });
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
      title={editing ? `Edit ${hospital.name}` : 'Add hospital'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="hosp-form" loading={busy}>
            {editing ? 'Save changes' : 'Add hospital'}
          </Button>
        </>
      }
    >
      <form id="hosp-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-4">
          <Field label="ID" className="col-span-1">
            <input className="input font-mono uppercase" value={form.id} disabled={editing} maxLength={24} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          </Field>
          <Field label="Name" className="col-span-2">
            <input className="input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
        </div>
        {!editing && (
          <Field label="Location" hint={freeNodes.length === 0 ? 'No free hospital node. Add one under Traffic Control, Graph editor.' : 'Only map nodes of type Hospital without a hospital are listed.'}>
            <Select className="input" value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: e.target.value })} aria-label="Hospital location">
              <option value="">Select a hospital node</option>
              {freeNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.id})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total beds">
            <input className="input font-mono" type="number" min="0" max="5000" value={form.totalBeds} onChange={(e) => setForm({ ...form, totalBeds: e.target.value })} />
          </Field>
          <Field label="Available beds">
            <input className="input font-mono" type="number" min="0" max="5000" value={form.availableBeds} onChange={(e) => setForm({ ...form, availableBeds: e.target.value })} />
          </Field>
        </div>
        <fieldset>
          <legend className="label">Specialties</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SPECIALTIES.map((s) => (
              <label key={s} className="flex items-center gap-2 rounded border border-line bg-ink-900 px-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={form.specialties.includes(s)} onChange={() => toggle(s)} /> {label(s)}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  );
}

export default function Hospitals() {
  const { isAdmin } = useAuth();
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  const signature = live ? live.hospitals.map((h) => `${h.id}${h.availableBeds}${h.status}${h.inbound}`).join('|') : '';
  const load = useCallback(() => {
    api
      .get('/hospitals')
      .then((res) => {
        setRows(res.hospitals);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load, signature]);

  const update = async (id, body, okMessage) => {
    try {
      await api.put(`/hospitals/${id}`, body);
      if (okMessage) toasts.success(okMessage);
      await refresh();
      load();
    } catch (err) {
      toasts.error('Could not update the hospital', err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hospitals"
        subtitle="Real Chennai hospitals with simulated bed counts and specialties. Bed counts drop when an ambulance delivers a patient, and closed or full hospitals are skipped by hospital selection."
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> Add hospital
            </Button>
          )
        }
      />
      <ErrorNote className="mb-4">{error}</ErrorNote>
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Panel>
          <Empty title="No hospitals" />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((h) => (
            <Panel key={h.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{h.id}</span>
                    <StatusTag status={h.status} />
                  </div>
                  <h3 className="mt-1 text-base leading-5">{h.name}</h3>
                  <div className="mt-0.5 text-xs text-muted">Map node <span className="font-mono">{h.nodeId}</span></div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 font-mono text-2xl text-fg">
                    <BedDouble size={18} className="text-faint" />
                    {h.availableBeds}
                  </div>
                  <div className="text-xs text-muted">of {h.totalBeds} beds</div>
                </div>
              </div>
              <div className="mt-3">
                <BedBar available={h.availableBeds} total={h.totalBeds} />
                {h.inbound > 0 && <div className="mt-1 text-xs text-warn">{h.inbound} ambulance{h.inbound === 1 ? '' : 's'} inbound</div>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {h.specialties.map((s) => (
                  <Tag key={s} color="#4aa3df">
                    {label(s)}
                  </Tag>
                ))}
              </div>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Button size="sm" onClick={() => update(h.id, { availableBeds: Math.max(0, h.availableBeds - 1) })} disabled={h.availableBeds <= 0} aria-label={`Remove one available bed at ${h.name}`}>
                    -1 bed
                  </Button>
                  <Button size="sm" onClick={() => update(h.id, { availableBeds: Math.min(h.totalBeds, h.availableBeds + 1) })} disabled={h.availableBeds >= h.totalBeds} aria-label={`Add one available bed at ${h.name}`}>
                    +1 bed
                  </Button>
                  <Button size="sm" onClick={() => update(h.id, { status: h.status === 'OPEN' ? 'CLOSED' : 'OPEN' }, `${h.name} ${h.status === 'OPEN' ? 'closed' : 'opened'}`)}>
                    <Power size={13} /> {h.status === 'OPEN' ? 'Close' : 'Open'}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setForm(h)}>
                    <Pencil size={13} /> Edit
                  </Button>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
      {form && <HospitalForm hospital={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { refresh(); load(); }} />}
    </div>
  );
}
