import { useCallback, useEffect, useState } from 'react';
import { Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button, ConfirmModal, Empty, ErrorNote, Field, Modal, PageHeader, Panel, Spinner, StatusTag } from '../components/ui';

const telHref = (n) => `tel:${String(n).replace(/[^0-9+]/g, '')}`;

function PhoneNumber({ value }) {
  if (!value) return <span className="text-faint">Not added</span>;
  return (
    <a href={telHref(value)} className="inline-flex items-center gap-1.5 font-mono text-fg hover:text-accent">
      <Phone size={13} /> {value}
    </a>
  );
}

function ContactForm({ contact, onClose, onSaved }) {
  const { live } = useLive();
  const editing = Boolean(contact);
  const [form, setForm] = useState({
    kind: contact ? contact.kind : 'HOSPITAL',
    name: contact ? contact.name : '',
    phone: contact ? contact.phone || '' : '',
    altPhone: contact ? contact.altPhone || '' : '',
    hospitalId: contact ? contact.hospitalId || '' : '',
    address: contact ? contact.address || '' : '',
    website: contact ? contact.website || '' : '',
    notes: contact ? contact.notes || '' : '',
    source: contact ? contact.source || '' : '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, hospitalId: form.kind === 'HOSPITAL' ? form.hospitalId || null : null };
      if (editing) await api.put(`/resources/${contact.id}`, body);
      else await api.post('/resources', body);
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
      title={editing ? `Edit ${contact.name}` : 'Add contact'}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="contact-form" loading={busy}>
            {editing ? 'Save changes' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className="input" value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="HOSPITAL">Hospital</option>
              <option value="HELPLINE">Helpline</option>
            </select>
          </Field>
          {form.kind === 'HOSPITAL' && (
            <Field label="Linked hospital" hint="Shows live bed status">
              <select className="input" value={form.hospitalId} onChange={(e) => set({ hospitalId: e.target.value })}>
                <option value="">Not linked</option>
                {live && live.hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Name">
          <input className="input" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className="input font-mono" maxLength={24} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Alternate or emergency phone">
            <input className="input font-mono" maxLength={24} value={form.altPhone} onChange={(e) => set({ altPhone: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <input className="input" maxLength={200} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Website">
            <input className="input" maxLength={200} placeholder="https://" value={form.website} onChange={(e) => set({ website: e.target.value })} />
          </Field>
          <Field label="Source of the number" hint="For example the hospital's contact page">
            <input className="input" maxLength={120} value={form.source} onChange={(e) => set({ source: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input min-h-[64px]" maxLength={300} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  );
}

export default function Resources() {
  const { isAdmin } = useAuth();
  const toasts = useToasts();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => {
    const t = window.setTimeout(() => {
      api
        .get(`/resources?q=${encodeURIComponent(q.trim())}`)
        .then((res) => {
          setRows(res.contacts);
          setError('');
        })
        .catch((err) => setError(err.message));
    }, 150);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(load, [load]);

  const reload = () => api.get(`/resources?q=${encodeURIComponent(q.trim())}`).then((res) => setRows(res.contacts));

  const remove = async () => {
    try {
      await api.del(`/resources/${removing.id}`);
      toasts.success('Contact removed');
      setRemoving(null);
      await reload();
    } catch (err) {
      toasts.error('Could not remove the contact', err.message);
      setRemoving(null);
    }
  };

  const helplines = rows ? rows.filter((c) => c.kind === 'HELPLINE') : [];
  const hospitals = rows ? rows.filter((c) => c.kind === 'HOSPITAL') : [];

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Public emergency helplines and hospital contact numbers for Chennai. Numbers can change, so confirm them with the hospital before relying on them. This simulation does not place calls."
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> Add contact
            </Button>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-faint" />
        <input className="input pl-9" placeholder="Search by name, number or address" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
      </div>
      <ErrorNote className="mb-4">{error}</ErrorNote>

      {!rows ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <Panel title="Emergency helplines" flush>
            {helplines.length === 0 ? (
              <Empty title="No helplines match" />
            ) : (
              <ul className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
                {helplines.map((c) => (
                  <li key={c.id} className="bg-ink-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-fg">{c.name}</div>
                        {c.notes && <div className="mt-1 text-xs text-muted">{c.notes}</div>}
                      </div>
                      <a href={telHref(c.phone)} className="shrink-0 font-mono text-2xl text-accent hover:no-underline">
                        {c.phone}
                      </a>
                    </div>
                    {isAdmin && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setForm(c)}>
                          <Pencil size={13} /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(c)}>
                          <Trash2 size={13} /> Remove
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Hospital directory" flush>
            {hospitals.length === 0 ? (
              <Empty title="No hospitals match" />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Hospital</th>
                      <th>Address</th>
                      <th>Phone</th>
                      <th>Emergency or alternate</th>
                      <th>Notes</th>
                      {isAdmin && <th className="text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="text-fg">{c.name}</div>
                          {c.hospital && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                              <StatusTag status={c.hospital.status} /> {c.hospital.availableBeds} of {c.hospital.totalBeds} simulated beds free
                            </div>
                          )}
                        </td>
                        <td className="max-w-[16rem] text-xs text-muted">{c.address || 'n/a'}</td>
                        <td>
                          <PhoneNumber value={c.phone} />
                        </td>
                        <td>
                          <PhoneNumber value={c.altPhone} />
                        </td>
                        <td className="max-w-[20rem] text-xs text-muted">
                          {c.notes}
                          {c.website && (
                            <div>
                              <a href={c.website} target="_blank" rel="noreferrer">
                                Website
                              </a>
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" onClick={() => setForm(c)}>
                                <Pencil size={13} /> Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setRemoving(c)} aria-label={`Remove ${c.name}`}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {form && <ContactForm contact={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={reload} />}
      {removing && <ConfirmModal title={`Remove ${removing.name}?`} message="The entry is deleted from the directory." confirmLabel="Remove" danger onConfirm={remove} onClose={() => setRemoving(null)} />}
    </div>
  );
}
