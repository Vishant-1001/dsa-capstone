import { useMemo, useState } from 'react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button, ErrorNote, Field, Modal, Segmented, Select } from './ui';
import { EMERGENCY_TYPES, EQUIPMENT, SEVERITIES, SEVERITY_COLOR, SPECIALTIES, TYPE_DEFAULTS } from '../utils/constants';
import { label } from '../utils/format';

/** Report (or edit) an emergency. On submit the server validates, stores and queues it. */
export default function ReportEmergencyModal({ onClose, onCreated, initialNodeId, emergency }) {
  const { graph } = useLive();
  const toasts = useToasts();
  const [form, setForm] = useState(
    emergency
      ? {
          type: emergency.type,
          severity: emergency.severity,
          nodeId: emergency.nodeId,
          requiredEquipment: emergency.requiredEquipment,
          requiredSpecialty: emergency.requiredSpecialty,
          description: emergency.description || '',
        }
      : {
          type: 'CARDIAC',
          severity: 'CRITICAL',
          nodeId: initialNodeId || '',
          requiredEquipment: TYPE_DEFAULTS.CARDIAC.equipment,
          requiredSpecialty: TYPE_DEFAULTS.CARDIAC.specialty,
          description: '',
        },
  );
  const [touched, setTouched] = useState(Boolean(emergency));
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const locations = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => n.type === 'JUNCTION' || n.type === 'BUILDING').sort((a, b) => a.name.localeCompare(b.name));
  }, [graph]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onType = (type) => {
    // Suggested requirements follow the type until the dispatcher changes them.
    if (touched) set({ type });
    else set({ type, requiredEquipment: TYPE_DEFAULTS[type].equipment, requiredSpecialty: TYPE_DEFAULTS[type].specialty });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.nodeId) next.nodeId = 'Choose where the emergency is';
    if (form.description.length > 300) next.description = 'Keep the description under 300 characters';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setApiError('');
    try {
      const res = emergency ? await api.put(`/emergencies/${emergency.id}`, form) : await api.post('/emergencies', form);
      if (res.merged) toasts.info('Report merged', `A waiting emergency already existed here, so this report was added to ${res.emergency.id}.`);
      onCreated(res);
      onClose();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={emergency ? `Edit ${emergency.id}` : 'Report new emergency'}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="report-form" loading={busy}>
            {emergency ? 'Save changes' : 'Add to priority queue'}
          </Button>
        </>
      }
    >
      <form id="report-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Emergency type">
            <select className="input" value={form.type} onChange={(e) => onType(e.target.value)}>
              {EMERGENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location" error={errors.nodeId}>
            <Select className="input" value={form.nodeId} onChange={(e) => set({ nodeId: e.target.value })} aria-label="Location">
              <option value="">Select a junction or building</option>
              {locations.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.id})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Severity" hint="Critical 10, High 7, Medium 5, Low 2. Higher priority is dispatched first.">
          <Segmented
            value={form.severity}
            onChange={(severity) => set({ severity })}
            options={SEVERITIES.map((s) => ({ value: s, label: label(s) }))}
            getColor={(v) => SEVERITY_COLOR[v]}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Required equipment">
            <select
              className="input"
              value={form.requiredEquipment}
              onChange={(e) => {
                setTouched(true);
                set({ requiredEquipment: e.target.value });
              }}
            >
              {EQUIPMENT.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Required hospital specialty">
            <select
              className="input"
              value={form.requiredSpecialty}
              onChange={(e) => {
                setTouched(true);
                set({ requiredSpecialty: e.target.value });
              }}
            >
              {SPECIALTIES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" error={errors.description} hint={`${form.description.length} of 300 characters. Use fictional details only.`}>
          <textarea className="input min-h-[84px] resize-y" maxLength={320} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What was reported" />
        </Field>

        <ErrorNote>{apiError}</ErrorNote>
      </form>
    </Modal>
  );
}
