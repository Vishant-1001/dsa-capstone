import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorNote, Field } from '../components/ui';

const ACCOUNTS = [
  { username: 'admin', password: 'Admin@123', role: 'Admin', note: 'Fleet, hospitals, map, traffic, analytics' },
  { username: 'dispatcher', password: 'Dispatch@123', role: 'Dispatcher', note: 'Emergencies and dispatch' },
];

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={(location.state && location.state.from) || '/dashboard'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-ink-900">
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-6 py-10 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="4" fill="#16202b" stroke="#273748" />
              <rect x="13" y="6" width="6" height="20" fill="#e5484d" />
              <rect x="6" y="13" width="20" height="6" fill="#e5484d" />
            </svg>
            <h1 className="text-3xl font-semibold tracking-tight">RapidResQ</h1>
          </div>
          <p className="mt-4 text-lg text-fg">Ambulance dispatch and emergency route optimization, simulated on a weighted road graph.</p>
          <p className="mt-3 max-w-md text-sm text-muted">Built as a Data Structures course project. The map is a simplified Chennai network with real localities and hospitals; emergencies, ambulances and bed counts are simulated.</p>
          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-fg">Triage</dt>
              <dd className="text-muted">Emergencies wait in a priority queue ordered by severity, then arrival time.</dd>
            </div>
            <div>
              <dt className="font-medium text-fg">Routing</dt>
              <dd className="text-muted">Dijkstra's algorithm on an adjacency list picks the ambulance and the hospital with the lowest travel time.</dd>
            </div>
            <div>
              <dt className="font-medium text-fg">Disruption</dt>
              <dd className="text-muted">Traffic changes and road closures reroute ambulances that are already moving.</dd>
            </div>
          </dl>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg">Sign in</h2>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Field label="Username">
              <input className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} />
            </Field>
            <Field label="Password">
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <Button variant="primary" type="submit" className="w-full" loading={busy}>
              Sign in
            </Button>
          </form>

          <div className="mt-6 border-t border-line pt-5">
            <div className="panel-title mb-2">Demo accounts</div>
            <ul className="space-y-2">
              {ACCOUNTS.map((a) => (
                <li key={a.username} className="flex items-center justify-between gap-3 rounded border border-line bg-ink-900 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-fg">
                      {a.role} <span className="font-mono text-xs text-muted">{a.username}</span>
                    </div>
                    <div className="truncate text-xs text-faint">{a.note}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword(a.password);
                      setError('');
                    }}
                  >
                    Fill in
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">Seeded accounts for evaluation. Change the passwords in Settings.</p>
          </div>
        </section>
      </div>

      <footer className="border-t border-line px-6 py-4 text-center text-xs text-faint">
        Simulation for coursework. Not for use in real emergencies.
        <span className="mx-3">
          <Link to="/terms">Terms and Conditions</Link>
        </span>
        <Link to="/privacy">Privacy Policy</Link>
      </footer>
    </div>
  );
}
