import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LiveProvider } from './hooks/useLive';
import AppLayout from './layouts/AppLayout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import { Terms, Privacy } from './pages/Legal';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Emergencies from './pages/Emergencies';
import DispatchCenter from './pages/DispatchCenter';
import Ambulances from './pages/Ambulances';
import Hospitals from './pages/Hospitals';
import Resources from './pages/Resources';
import SettingsPage from './pages/Settings';
import DataStructures, { DataStructuresOverview } from './pages/DataStructures';
import PriorityQueuePage from './pages/PriorityQueuePage';
import DijkstraPage from './pages/DijkstraPage';

// Heavier pages load on demand so the first screen stays quick.
const TrafficControl = lazy(() => import('./pages/TrafficControl'));
const MissionHistory = lazy(() => import('./pages/MissionHistory'));
const Analytics = lazy(() => import('./pages/Analytics'));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner text="Restoring session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <LiveProvider>{children}</LiveProvider>;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl">Not available for your role</h1>
        <p className="mt-2 text-sm text-muted">This page is limited to {roles.join(' and ').toLowerCase()} accounts.</p>
        <Link to="/dashboard" className="mt-4 inline-block">
          Back to the dashboard
        </Link>
      </div>
    );
  }
  return children;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you asked for does not exist.</p>
      <Link to="/" className="mt-4 inline-block">
        Go to the dashboard
      </Link>
    </div>
  );
}

const admin = (el) => <RequireRole roles={['ADMIN']}>{el}</RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/map" element={<LiveMap />} />
        <Route path="/emergencies" element={<Emergencies />} />
        <Route path="/dispatch" element={<DispatchCenter />} />
        <Route path="/ambulances" element={<Ambulances />} />
        <Route path="/hospitals" element={<Hospitals />} />
        <Route path="/resources" element={<Resources />} />
        <Route
          path="/traffic"
          element={admin(
            <Suspense fallback={<Spinner />}>
              <TrafficControl />
            </Suspense>,
          )}
        />
        <Route
          path="/history"
          element={admin(
            <Suspense fallback={<Spinner />}>
              <MissionHistory />
            </Suspense>,
          )}
        />
        <Route
          path="/analytics"
          element={admin(
            <Suspense fallback={<Spinner />}>
              <Analytics />
            </Suspense>,
          )}
        />
        <Route path="/data-structures" element={<DataStructures />}>
          <Route index element={<DataStructuresOverview />} />
          <Route path="priority-queue" element={<PriorityQueuePage />} />
          <Route path="dijkstra" element={<DijkstraPage />} />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
