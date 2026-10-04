import { useLive } from '../hooks/useLive';
import { Empty, StatusTag, Tag } from './ui';
import { SEVERITY_COLOR, TRAFFIC_COLOR, TRAFFIC_LABEL } from '../utils/constants';
import { fmtKm, fmtMin, label } from '../utils/format';

function Row({ k, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 break-words text-right text-fg">{children}</span>
    </div>
  );
}

export function TrafficTag({ level, closed }) {
  if (closed) return <Tag color="#e5484d">Closed</Tag>;
  return <Tag color={TRAFFIC_COLOR[level]}>{TRAFFIC_LABEL[level] || level}</Tag>;
}

export function NodeDetails({ nodeId, onSelectRoad }) {
  const { graph, live, nodeById } = useLive();
  const node = nodeById[nodeId];
  if (!node || !graph || !live) return <Empty title="Nothing selected">Click a node, road or ambulance on the map.</Empty>;

  const liveRoads = {};
  live.roads.forEach((r) => { liveRoads[r.id] = r; });
  const roads = graph.roads.filter((r) => r.source === nodeId || r.destination === nodeId);
  const hospital = live.hospitals.find((h) => h.nodeId === nodeId);
  const here = live.ambulances.filter((a) => a.nodeId === nodeId && !a.movement);
  const homed = live.ambulances.filter((a) => a.homeStationId === nodeId);
  const emergencies = live.emergencies.filter((e) => e.nodeId === nodeId);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base">{node.name}</h3>
        <Tag>{label(node.type)}</Tag>
      </div>
      <Row k="Node ID">
        <span className="font-mono">{node.id}</span>
      </Row>
      <Row k="Position">
        <span className="font-mono">
          {node.x}, {node.y}
        </span>
      </Row>
      <Row k="Connected roads">{roads.length}</Row>

      {hospital && (
        <div className="mt-3 rounded border border-line bg-ink-900 p-3 text-sm">
          <div className="font-medium text-fg">{hospital.name}</div>
          <div className="mt-1 text-xs text-muted">
            {hospital.availableBeds} of {hospital.totalBeds} beds free, <StatusTag status={hospital.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {hospital.specialties.map((s) => (
              <Tag key={s}>{label(s)}</Tag>
            ))}
          </div>
        </div>
      )}

      {node.type === 'STATION' && (
        <div className="mt-3 text-sm">
          <div className="panel-title mb-1">Based here</div>
          <div className="flex flex-wrap gap-1.5">
            {homed.length === 0 && <span className="text-xs text-muted">No ambulances assigned</span>}
            {homed.map((a) => (
              <Tag key={a.id} color="#4aa3df" title={label(a.status)}>
                {a.id} {a.equipment}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {here.length > 0 && node.type !== 'STATION' && (
        <div className="mt-3 text-sm">
          <div className="panel-title mb-1">Parked here</div>
          <div className="flex flex-wrap gap-1.5">
            {here.map((a) => (
              <Tag key={a.id}>
                {a.id} {label(a.status)}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {emergencies.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="panel-title mb-1">Emergencies here</div>
          <ul className="space-y-1">
            {emergencies.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-fg">{e.id}</span>
                <Tag color={SEVERITY_COLOR[e.severity]}>{e.severity}</Tag>
                <span className="text-muted">{label(e.type)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="panel-title mb-1">Roads</div>
        <ul className="space-y-1">
          {roads.map((r) => {
            const other = nodeById[r.source === nodeId ? r.destination : r.source];
            const state = liveRoads[r.id] || r;
            return (
              <li key={r.id}>
                <button type="button" className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ink-700" onClick={() => onSelectRoad && onSelectRoad(r.id)}>
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-muted">{r.id}</span> <span className="text-fg">{other ? other.name : ''}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-muted">{fmtMin(state.currentTravelTime || r.currentTravelTime)}</span>
                    <TrafficTag level={state.trafficLevel} closed={state.isClosed} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function RoadDetails({ roadId }) {
  const { graph, live, nodeById } = useLive();
  const road = graph && graph.roads.find((r) => r.id === roadId);
  if (!road || !live) return null;
  const state = live.roads.find((r) => r.id === roadId) || road;
  const a = nodeById[road.source];
  const b = nodeById[road.destination];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-base">{road.id}</h3>
        <TrafficTag level={state.trafficLevel} closed={state.isClosed} />
      </div>
      <Row k="From">{a ? a.name : road.source}</Row>
      <Row k="To">{b ? b.name : road.destination}</Row>
      <Row k="Distance">{fmtKm(road.distance)}</Row>
      <Row k="Normal travel time">{fmtMin(road.normalTravelTime)}</Row>
      <Row k="Current travel time">{state.isClosed ? 'Closed' : fmtMin(state.currentTravelTime)}</Row>
    </div>
  );
}
