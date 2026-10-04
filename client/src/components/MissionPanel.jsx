import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, MapPin, Navigation as RouteIcon, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { useToasts } from '../hooks/useToasts';
import { Button, ErrorNote, Modal, SeverityTag, StatusTag, Tag } from './ui';
import { fmtKm, fmtMin, label, pathString } from '../utils/format';

/** Result of the hospital selection algorithm: every candidate, the winner and why. */
export function HospitalSelectionModal({ selection, onClose }) {
  const { nodeById } = useLive();
  const chosen = selection.selected;
  return (
    <Modal title="Hospital selection" onClose={onClose} width="max-w-2xl" footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      <p className="mb-3 text-sm text-fg">{selection.explanation}</p>
      <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
        {[['Hospitals', selection.pipeline.total], ['Open', selection.pipeline.open.length], [`Beds and ${label(selection.specialty)}`, selection.pipeline.specialtyMatch.length], ['Reachable', selection.pipeline.reachable.length]].map(([k, v]) => (
          <div key={k} className="rounded border border-line bg-ink-900 px-2 py-2">
            <div className="font-mono text-lg text-fg">{v}</div>
            <div className="text-muted">{k}</div>
          </div>
        ))}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Hospital</th>
            <th>Beds</th>
            <th>ETA</th>
            <th>Distance</th>
          </tr>
        </thead>
        <tbody>
          {selection.candidates.map((c) => (
            <tr key={c.hospitalId}>
              <td>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {chosen && c.hospitalId === chosen.hospitalId && <Tag color="#3fb68b">Selected</Tag>}
                </div>
                <div className="mt-0.5 font-mono text-2xs text-faint">{pathString(c.path, nodeById)}</div>
              </td>
              <td className="font-mono">{c.availableBeds}</td>
              <td className="font-mono">{c.reachable ? fmtMin(c.travelTime) : 'unreachable'}</td>
              <td className="font-mono">{c.reachable ? fmtKm(c.distance) : 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selection.rejected.length > 0 && (
        <div className="mt-4">
          <div className="panel-title mb-1">Filtered out</div>
          <ul className="space-y-0.5 text-xs text-muted">
            {selection.rejected.map((r) => (
              <li key={r.hospitalId}>
                {r.name}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function Row({ k, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 break-words text-right text-fg">{children}</span>
    </div>
  );
}

/** Live view of one active mission with the actions that apply to its current status. */
export default function MissionPanel({ missionId, onChanged }) {
  const { live, nodeById, refresh } = useLive();
  const toasts = useToasts();
  const mission = live && live.missions.find((m) => m.id === missionId);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState(null);
  const status = mission ? mission.status : null;

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/missions/${missionId}`)
      .then((res) => !cancelled && setDetail(res.mission))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [missionId, status]);

  const act = useCallback(
    async (fn) => {
      setBusy(true);
      setError('');
      try {
        await fn();
        await refresh();
        if (onChanged) onChanged();
      } catch (err) {
        setError(err.message);
        if (err.details && err.details.selection) setSelection(err.details.selection);
      } finally {
        setBusy(false);
      }
    },
    [refresh, onChanged],
  );

  if (!mission) {
    if (!detail) return <p className="text-sm text-muted">Mission {missionId} is not active.</p>;
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-fg">{detail.id}</span> <StatusTag status={detail.status} />
        </div>
        <p className="text-muted">This mission has finished. Full details are in Mission History.</p>
      </div>
    );
  }

  const mv = mission.movement;
  const route = mission.leg === 'SCENE' ? mission.sceneRoute : mission.hospitalRoute;
  const path = mv ? mv.path : route ? route.path : [];
  const emergency = live.emergencies.find((e) => e.id === mission.emergencyId);
  const hospital = mission.hospitalId ? live.hospitals.find((h) => h.id === mission.hospitalId) : null;
  const destination = mv ? nodeById[mv.destinationNodeId] : null;
  const currentRoad = mv && mv.currentRoadId ? mv.currentRoadId : null;

  const onPickup = () => act(async () => {
    const res = await api.post(`/missions/${mission.id}/pickup`);
    setSelection(res.selection);
  });
  const onComplete = () => act(async () => {
    await api.post(`/missions/${mission.id}/complete`);
    toasts.success('Mission completed', `${mission.id} was completed without the remaining travel time.`);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base text-fg">{mission.id}</span>
        <StatusTag status={mission.status} />
        <SeverityTag severity={mission.severity} />
      </div>

      {status === 'AT_SCENE' && (
        <div className="rounded border border-ok/50 bg-ok/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ok">
            <CheckCircle2 size={16} /> AMBULANCE ARRIVED
          </div>
          <p className="mt-1 text-xs text-muted">{mission.ambulanceId} is at the scene. Picking up the patient runs hospital selection and starts the transport.</p>
          <Button variant="ok" className="mt-3 w-full" onClick={onPickup} loading={busy}>
            <HeartPulse size={16} /> PICK UP PATIENT
          </Button>
        </div>
      )}

      {mv && mv.blocked && (
        <div className="flex items-start gap-2 rounded border border-crit/60 bg-crit/10 p-3 text-sm font-semibold text-red-200">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-crit" />
          <div>
            DESTINATION CURRENTLY UNREACHABLE
            <div className="mt-0.5 text-xs font-normal text-muted">{mission.ambulanceId} holds position. Reopen a road to restore a route.</div>
          </div>
        </div>
      )}
      {mv && mv.awaitingHospital && (
        <div className="rounded border border-crit/60 bg-crit/10 p-3 text-sm text-red-200">No hospital can accept the patient. Free a bed or reopen a hospital with the required specialty.</div>
      )}

      <div>
        <Row k="Emergency">
          {mission.emergencyId}
          {emergency ? `, ${label(emergency.type)} at ${emergency.locationName}` : ''}
        </Row>
        <Row k="Ambulance">{mission.ambulanceId}</Row>
        {hospital && <Row k="Hospital">{hospital.name}</Row>}
        <Row k="Leg">{mission.leg === 'SCENE' ? 'To scene' : 'To hospital'}</Row>
        {mv && (
          <>
            <Row k="ETA">{mv.blocked ? 'Blocked' : fmtMin(mv.etaMinutes)}</Row>
            <Row k="Remaining distance">{fmtKm(mv.remainingDistance)}</Row>
            <Row k="Current node">{mv.currentNodeId && nodeById[mv.currentNodeId] ? `${nodeById[mv.currentNodeId].name} (${mv.currentNodeId})` : 'n/a'}</Row>
            <Row k="Current road">{currentRoad || 'n/a'}</Row>
            <Row k="Destination">{destination ? destination.name : 'n/a'}</Row>
          </>
        )}
        {route && (
          <>
            <Row k="Algorithm">Dijkstra</Row>
            <Row k="Planned distance">{fmtKm(route.distance)}</Row>
            <Row k="Planned time">{fmtMin(route.time)}</Row>
            <Row k="Nodes visited">{route.visitedCount}</Row>
          </>
        )}
        {mission.responseTime !== null && mission.responseTime !== undefined && <Row k="Response time">{fmtMin(mission.responseTime)}</Row>}
      </div>

      <div>
        <div className="panel-title mb-1 flex items-center gap-1.5">
          <RouteIcon size={12} /> {mv ? 'Remaining path' : 'Path'}
        </div>
        <p className="break-words font-mono text-xs leading-5 text-accent">{pathString(path, nodeById)}</p>
      </div>

      {mission.reroutes.length > 0 && (
        <div>
          <div className="panel-title mb-1">Reroutes ({mission.rerouteCount})</div>
          <ul className="space-y-1 text-xs text-muted">
            {mission.reroutes.map((r, i) => (
              <li key={`${r.at}-${i}`} className="rounded border border-line bg-ink-900 px-2 py-1.5">
                <span className="text-warn">ETA {r.etaBefore === null || r.etaBefore === undefined ? 'blocked' : fmtMin(r.etaBefore)} to {fmtMin(r.etaAfter)}</span>
                <div>{r.trigger}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail && detail.selectionLog && (
        <div>
          <div className="panel-title mb-1 flex items-center gap-1.5">
            <MapPin size={12} /> Why this ambulance
          </div>
          <p className="text-xs text-muted">{detail.selectionLog.explanation}</p>
        </div>
      )}
      {detail && detail.hospitalLog && (
        <div>
          <div className="panel-title mb-1">Why this hospital</div>
          <p className="text-xs text-muted">{detail.hospitalLog.explanation}</p>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {status === 'TRANSPORTING' && mv && !mv.blocked && (
        <Button size="sm" variant="ghost" onClick={onComplete} loading={busy}>
          Complete now (skip remaining travel)
        </Button>
      )}

      {selection && <HospitalSelectionModal selection={selection} onClose={() => setSelection(null)} />}
    </div>
  );
}
