import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useAuth } from '../hooks/useAuth';
import CityMap, { MapLegend } from '../components/CityMap';
import ReportEmergencyModal from '../components/ReportEmergencyModal';
import { RunDemoButton } from '../components/DemoPanel';
import { Button, Empty, PageHeader, Panel, SeverityTag, Spinner, Stat, StatusTag, Tag } from '../components/ui';
import { AMBULANCE_STATUS_COLOR } from '../utils/constants';
import { fmtMin, fmtTime, label } from '../utils/format';

const ALERT_COLOR = { critical: '#e5484d', warning: '#e0a93a', info: '#4aa3df' };

export default function Dashboard() {
  const { live, graph } = useLive();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(false);
  const [recent, setRecent] = useState([]);
  const completed = live ? live.kpis.completedMissions : 0;
  const cancelledCount = live ? live.kpis.totalEmergencies - live.kpis.activeEmergencies - completed : 0;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/emergencies?status=COMPLETED')
      .then((res) => !cancelled && setRecent(res.emergencies.slice(0, 6)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [completed]);

  if (!live) return <Spinner text="Loading live data" />;
  const k = live.kpis;
  const active = live.emergencies;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Signed in as ${user.fullName}. Every figure below is read from the database or the live simulation.`}
        actions={
          <>
            <RunDemoButton />
            <Button variant="primary" onClick={() => setReport(true)}>
              <Plus size={16} /> Report emergency
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total emergencies" value={k.totalEmergencies} hint={`${k.pendingEmergencies} waiting in the queue`} />
        <Stat label="Critical emergencies" value={k.criticalActive} hint={`${k.criticalTotal} reported in total`} accent={k.criticalActive > 0 ? '#e5484d' : undefined} />
        <Stat label="Available ambulances" value={k.availableAmbulances} hint={`of ${k.totalAmbulances} units`} accent="#3fb68b" />
        <Stat label="Busy ambulances" value={k.busyAmbulances} hint={k.offlineAmbulances ? `${k.offlineAmbulances} offline` : 'None offline'} />
        <Stat label="Available hospital beds" value={k.availableBeds} hint={`of ${k.totalBeds} beds, ${k.openHospitals} of ${k.totalHospitals} hospitals open`} />
        <Stat label="Active missions" value={k.activeMissions} hint="Dispatched through transport" />
        <Stat label="Completed missions" value={k.completedMissions} hint={cancelledCount > 0 ? `${cancelledCount} emergencies cancelled` : undefined} />
        <Stat label="Average response time" value={k.avgResponseTime === null ? 'n/a' : fmtMin(k.avgResponseTime)} hint={k.avgResponseTime === null ? 'No completed missions yet' : 'Report to arrival, simulation minutes'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Active emergencies" className="xl:col-span-2" flush actions={<Link to="/emergencies" className="text-xs">View all</Link>}>
          {active.length === 0 ? (
            <Empty title="No active emergencies">Report one to see it enter the priority queue.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Ambulance</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono">
                        <Link to={`/emergencies?focus=${e.id}`}>{e.id}</Link>
                      </td>
                      <td>
                        <SeverityTag severity={e.severity} />
                      </td>
                      <td>{label(e.type)}</td>
                      <td>{e.locationName}</td>
                      <td>
                        <StatusTag status={e.status} />
                      </td>
                      <td className="font-mono">{e.assignedAmbulanceId || 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Ambulance status" flush>
          <ul>
            {live.ambulances.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AMBULANCE_STATUS_COLOR[a.status] }} />
                  <span className="font-mono text-sm">{a.id}</span>
                  <Tag>{a.equipment}</Tag>
                </div>
                <div className="text-right text-xs text-muted">
                  {label(a.status)}
                  {a.movement && !a.movement.blocked && <span className="ml-2 font-mono text-fg">{fmtMin(a.movement.etaMinutes)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Recent missions" flush className="xl:col-span-1">
          {recent.length === 0 ? (
            <Empty title="No completed missions yet">Completed emergencies appear here once a mission delivers a patient.</Empty>
          ) : (
            <ul>
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-sm last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{e.id}</span>
                      <SeverityTag severity={e.severity} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {label(e.type)} at {e.locationName}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    <div className="font-mono text-fg">{e.assignedAmbulanceId}</div>
                    {fmtTime(e.completedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="System alerts" flush>
          {live.alerts.length === 0 ? (
            <Empty title="No active alerts">Closed roads, full hospitals and blocked ambulances show up here.</Empty>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {live.alerts.map((a, i) => (
                <li key={`${a.title}-${i}`} className="border-b border-line px-4 py-2.5 last:border-b-0" style={{ borderLeft: `3px solid ${ALERT_COLOR[a.level]}` }}>
                  <div className="text-sm font-medium text-fg">{a.title}</div>
                  <div className="text-xs text-muted">{a.message}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Live city overview" flush actions={<Link to="/map" className="text-xs">Open map</Link>}>
          <div className="aspect-[1000/620] w-full cursor-pointer" onClick={() => navigate('/map')} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/map')} aria-label="Open the live map">
            <CityMap graph={graph} live={live} showLabels={false} />
          </div>
          <div className="border-t border-line p-3">
            <MapLegend />
          </div>
        </Panel>
      </div>

      {report && <ReportEmergencyModal onClose={() => setReport(false)} onCreated={() => navigate('/dispatch')} />}
    </div>
  );
}
