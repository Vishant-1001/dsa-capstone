import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import SimControls from '../components/SimControls';
import { Button, ConfirmModal, ErrorNote, Field, PageHeader, Panel, Tag } from '../components/ui';

function PasswordForm() {
  const toasts = useToasts();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toasts.success('Password changed', 'Use the new password the next time you sign in.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Current password">
        <input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </Field>
      <Field label="New password" hint="At least 8 characters with a letter and a digit.">
        <input className="input" type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      </Field>
      <Field label="Confirm new password">
        <input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" type="submit" loading={busy}>
        Change password
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { live, refresh } = useLive();
  const toasts = useToasts();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const setOption = async (body) => {
    try {
      await api.put('/sim', body);
      await refresh();
    } catch (err) {
      toasts.error('Could not change the setting', err.message);
    }
  };
  const setAuto = (value) => setOption({ autoDispatch: value });

  const reset = async () => {
    setBusy(true);
    try {
      await api.post('/sim/reset');
      await refresh();
      toasts.success('Simulation reset', 'Emergencies, missions and traffic history were cleared and the demo city restored.');
      setConfirmReset(false);
    } catch (err) {
      toasts.error('Reset failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account and the simulation." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Account">
          <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="text-fg">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-muted">Username</dt>
              <dd className="font-mono text-fg">{user.username}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd>
                <Tag color="#4aa3df">{user.role}</Tag>
              </dd>
            </div>
          </dl>
          <PasswordForm />
        </Panel>

        <div className="space-y-5">
          <Panel title="Simulation">
            <div className="space-y-4 text-sm">
              <div>
                <div className="mb-2 text-muted">Speed and pause apply to every ambulance. At 1x one simulation minute takes one second.</div>
                <SimControls />
              </div>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={Boolean(live && live.autoDispatch)} onChange={(e) => setAuto(e.target.checked)} />
                <span>
                  <span className="text-fg">Auto-dispatch</span>
                  <span className="block text-xs text-muted">Every few seconds the server dispatches queued emergencies, highest priority first, whenever a suitable ambulance is free.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={Boolean(live && live.autoReturn)} onChange={(e) => setOption({ autoReturn: e.target.checked })} />
                <span>
                  <span className="text-fg">Return to station after delivery</span>
                  <span className="block text-xs text-muted">An ambulance that has delivered a patient drives back to its home station, with status RETURNING, before it can be dispatched again.</span>
                </span>
              </label>
              <p className="text-xs text-muted">
                The simulation clock advances only while an ambulance is moving. Response time is measured on that clock, from the report to arrival at the scene.
              </p>
            </div>
          </Panel>

          {isAdmin && (
            <Panel title="Reset simulation data">
              <p className="mb-3 text-sm text-muted">Clears emergencies, missions and traffic history, restores the original map, ambulances and hospital beds. User accounts are kept.</p>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                Reset simulation data
              </Button>
            </Panel>
          )}

          <Panel title="About">
            <p className="text-sm text-muted">
              RapidResQ simulates pre-hospital emergency response for a Data Structures course. It uses fictional data and must not be used for real emergencies.
            </p>
            <p className="mt-3 space-x-4 text-sm">
              <Link to="/terms">Terms and Conditions</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </p>
          </Panel>
        </div>
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Reset simulation data?"
          message="This deletes every emergency, mission and traffic event and cannot be undone. Any active missions will be lost."
          confirmLabel="Reset data"
          danger
          loading={busy}
          onConfirm={reset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
