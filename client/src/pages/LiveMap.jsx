import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLive } from '../hooks/useLive';
import CityMap, { MapLegend } from '../components/CityMap';
import MissionPanel from '../components/MissionPanel';
import SimControls from '../components/SimControls';
import { NodeDetails, RoadDetails } from '../components/NodeDetails';
import { Empty, PageHeader, Panel, SeverityTag, Spinner, StatusTag } from '../components/ui';
import { fmtMin, label } from '../utils/format';

export default function LiveMap() {
  const { live, graph } = useLive();
  const [params] = useSearchParams();
  const [selection, setSelection] = useState(null); // { type: 'node' | 'road' | 'ambulance', id }
  const [missionId, setMissionId] = useState(params.get('mission'));
  const [labels, setLabels] = useState(true);

  const missions = live ? live.missions : [];
  // Follow the first active mission when none is chosen yet.
  useEffect(() => {
    if (!missionId && missions.length) setMissionId(missions[0].id);
    if (missionId && live && !missions.some((m) => m.id === missionId) && missions.length) setMissionId(missions[0].id);
  }, [missions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live || !graph) return <Spinner text="Loading map" />;

  const ambulance = selection && selection.type === 'ambulance' ? live.ambulances.find((a) => a.id === selection.id) : null;
  const activeMission = missions.find((m) => m.id === missionId);

  return (
    <div>
      <PageHeader
        title="Live Map"
        subtitle="Chennai road network. Roads are coloured by traffic and routes show the remaining path of each moving ambulance."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Labels
            </label>
            <SimControls />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel flush className="overflow-hidden">
          <div className="aspect-[1000/620] w-full">
            <CityMap
              graph={graph}
              live={live}
              showLabels={labels}
              selectedNodeId={selection && selection.type === 'node' ? selection.id : null}
              selectedRoadId={selection && selection.type === 'road' ? selection.id : null}
              selectedAmbulanceId={ambulance ? ambulance.id : null}
              onSelectNode={(id) => setSelection({ type: 'node', id })}
              onSelectRoad={(id) => setSelection({ type: 'road', id })}
              onSelectAmbulance={(id) => {
                setSelection({ type: 'ambulance', id });
                const a = live.ambulances.find((x) => x.id === id);
                if (a && a.currentMissionId) setMissionId(a.currentMissionId);
              }}
            />
          </div>
          <div className="border-t border-line p-3">
            <MapLegend className="sm:grid-cols-4 lg:grid-cols-6" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Selection">
            {!selection && <Empty title="Nothing selected">Click a node, road or ambulance on the map.</Empty>}
            {selection && selection.type === 'node' && <NodeDetails nodeId={selection.id} onSelectRoad={(id) => setSelection({ type: 'road', id })} />}
            {selection && selection.type === 'road' && <RoadDetails roadId={selection.id} />}
            {ambulance && (
              <div className="text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-mono text-base">{ambulance.id}</h3>
                  <StatusTag status={ambulance.status} />
                </div>
                <p className="text-muted">
                  {ambulance.equipment} unit{ambulance.movement ? `, ETA ${ambulance.movement.blocked ? 'blocked' : fmtMin(ambulance.movement.etaMinutes)}` : `, parked at ${ambulance.nodeId}`}.
                </p>
              </div>
            )}
          </Panel>

          <Panel title={`Active missions (${missions.length})`} flush>
            {missions.length === 0 ? (
              <Empty title="No active missions">Dispatch an emergency to see an ambulance move.</Empty>
            ) : (
              <ul>
                {missions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMissionId(m.id)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-ink-700 ${m.id === missionId ? 'bg-ink-700' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{m.ambulanceId}</span>
                        <SeverityTag severity={m.severity} />
                      </div>
                      <div className="text-right text-xs text-muted">
                        {label(m.status)}
                        {m.movement && <span className="ml-2 font-mono text-fg">{m.movement.blocked ? 'blocked' : fmtMin(m.movement.etaMinutes)}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {activeMission && (
            <Panel title="Mission details">
              <MissionPanel missionId={activeMission.id} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
