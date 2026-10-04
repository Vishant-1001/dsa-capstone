import { useMemo } from 'react';
import { AMBULANCE_STATUS_COLOR, SEVERITY_COLOR, TRAFFIC_COLOR } from '../utils/constants';
import { useTiles } from '../utils/geo';
import { clsx, label } from '../utils/format';

const W = 1000;
const H = 620;
const ROUTE_SCENE = '#4aa3df';
const ROUTE_HOSPITAL = '#3fb68b';

const halo = { paintOrder: 'stroke', stroke: '#0b0f14', strokeWidth: 3, strokeLinejoin: 'round' };

function NodeGlyph({ node, selected, color }) {
  const stroke = selected ? '#4aa3df' : color || '#6b7d90';
  switch (node.type) {
    case 'STATION':
      return (
        <g>
          <rect x={-13} y={-9} width={26} height={18} rx={2} fill="#12384f" stroke={selected ? '#4aa3df' : '#4aa3df99'} strokeWidth={selected ? 2.5 : 1.5} />
          <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={600} fill="#9fd0f0" fontFamily="IBM Plex Mono, monospace">
            ST
          </text>
        </g>
      );
    case 'HOSPITAL':
      return (
        <g>
          <rect x={-13} y={-13} width={26} height={26} rx={2} fill="#e8edf2" stroke={selected ? '#4aa3df' : '#e8edf2'} strokeWidth={selected ? 3 : 1} />
          <path d="M-2.6 -8h5.2v5.4h5.4v5.2h-5.4v5.4h-5.2v-5.4h-5.4v-5.2h5.4z" fill="#d6403f" />
        </g>
      );
    case 'BUILDING':
      return <rect x={-7} y={-7} width={14} height={14} rx={1.5} fill="#1b2633" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />;
    default:
      return <circle r={6} fill="#1b2633" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />;
  }
}

/**
 * SVG city map. Pure view: everything it draws comes from the graph and the live snapshot.
 * routes: extra polylines [{ key, path, color, width, dashed, opacity }]
 */
export default function CityMap({
  graph,
  live,
  selectedNodeId,
  onSelectNode,
  selectedRoadId,
  onSelectRoad,
  selectedAmbulanceId,
  onSelectAmbulance,
  routes = [],
  showMissionRoutes = true,
  showLabels = true,
  showAmbulances = true,
  showEmergencies = true,
  nodeColors,
  nodeNotes,
  onMapClick,
  marker,
  className,
}) {
  const nodeById = useMemo(() => {
    const out = {};
    if (graph) graph.nodes.forEach((n) => { out[n.id] = n; });
    return out;
  }, [graph]);
  const tiles = useTiles();

  const liveRoads = useMemo(() => {
    const out = {};
    if (live) live.roads.forEach((r) => { out[r.id] = r; });
    return out;
  }, [live]);

  if (!graph) return <div className={clsx('flex items-center justify-center text-sm text-muted', className)}>Loading map</div>;

  const pointsFor = (path) => path.map((id) => nodeById[id]).filter(Boolean).map((n) => `${n.x},${n.y}`).join(' ');

  const missionLines = [];
  if (live && showMissionRoutes) {
    live.missions.forEach((m) => {
      const mv = m.movement;
      if (!mv) return;
      const amb = live.ambulances.find((a) => a.id === m.ambulanceId);
      const remaining = mv.path.slice(mv.segIndex + 1).map((id) => nodeById[id]).filter(Boolean);
      const start = amb && amb.position ? amb.position : nodeById[mv.path[mv.segIndex]];
      if (!start) return;
      const pts = [`${start.x},${start.y}`].concat(remaining.map((n) => `${n.x},${n.y}`)).join(' ');
      const color = mv.blocked ? '#e5484d' : mv.kind === 'HOSPITAL' ? ROUTE_HOSPITAL : ROUTE_SCENE;
      if (mv.oldPaths && mv.oldPaths[0]) {
        missionLines.push({ key: `${m.id}-old`, points: pointsFor(mv.oldPaths[0]), color: '#8593a3', width: 3, dashed: '2 6', opacity: 0.7 });
      }
      missionLines.push({ key: m.id, points: pts, color, width: 5, dashed: mv.blocked ? '8 6' : null, opacity: 0.95 });
    });
  }

  const extraLines = routes.map((r) => ({ key: r.key, points: pointsFor(r.path), color: r.color, width: r.width || 5, dashed: r.dashed || null, opacity: r.opacity === undefined ? 0.95 : r.opacity }));

  // Stationary ambulances on one node are spread out so none hides another.
  const parked = {};
  const ambulances = live && showAmbulances ? live.ambulances : [];
  ambulances.forEach((a) => {
    if (!a.movement) {
      parked[a.nodeId] = parked[a.nodeId] || [];
      parked[a.nodeId].push(a.id);
    }
  });

  const emergencies = live && showEmergencies ? live.emergencies : [];
  const emergencyIndex = {};

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={clsx('block h-full w-full', className)} role="img" aria-label="City road network map" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#162230" strokeWidth="1" />
        </pattern>
      </defs>
      <rect
        width={W}
        height={H}
        fill="#0b1118"
        onClick={
          onMapClick
            ? (e) => {
                const box = e.currentTarget.getBoundingClientRect();
                onMapClick({ x: Math.round(((e.clientX - box.left) / box.width) * W), y: Math.round(((e.clientY - box.top) / box.height) * H) });
              }
            : undefined
        }
        style={{ cursor: onMapClick ? 'crosshair' : 'default' }}
      />
      <g pointerEvents="none" aria-hidden="true">
        {tiles.map((t) => (
          <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.width} height={t.height} preserveAspectRatio="none" />
        ))}
      </g>
      <rect width={W} height={H} fill="#0b1118" opacity={0.1} pointerEvents="none" />
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        <text x={W - 6} y={H - 6} textAnchor="end" fontSize={9} fill="#8593a3" style={halo}>
          OpenStreetMap contributors / CARTO
        </text>
      </a>

      {/* roads */}
      {graph.roads.map((r) => {
        const a = nodeById[r.source];
        const b = nodeById[r.destination];
        if (!a || !b) return null;
        const state = liveRoads[r.id] || r;
        const closed = state.isClosed;
        const color = closed ? '#e5484d' : TRAFFIC_COLOR[state.trafficLevel] || TRAFFIC_COLOR.LOW;
        const selected = selectedRoadId === r.id;
        return (
          <g key={r.id}>
            {selected && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4aa3df" strokeWidth={11} opacity={0.35} />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b0f14" strokeWidth={7} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={closed ? 3 : 3.5} strokeDasharray={closed ? '6 5' : undefined} />
            {closed && (
              <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
                <circle r={7.5} fill="#0b0f14" stroke="#e5484d" strokeWidth={1.5} />
                <path d="M-3 -3L3 3M3 -3L-3 3" stroke="#e5484d" strokeWidth={1.8} />
              </g>
            )}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="transparent"
              strokeWidth={14}
              style={{ cursor: onSelectRoad ? 'pointer' : 'default' }}
              onClick={onSelectRoad ? () => onSelectRoad(r.id) : undefined}
            >
              <title>{`${r.id}: ${nodeById[r.source].name} to ${nodeById[r.destination].name}, ${state.currentTravelTime || r.currentTravelTime} min, ${closed ? 'CLOSED' : state.trafficLevel}`}</title>
            </line>
          </g>
        );
      })}

      {/* route overlays */}
      {[...missionLines, ...extraLines].map((l) => (
        <polyline key={l.key} points={l.points} fill="none" stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dashed || undefined} strokeLinecap="round" strokeLinejoin="round" opacity={l.opacity} pointerEvents="none" />
      ))}

      {/* nodes */}
      {graph.nodes.map((n) => {
        const selected = selectedNodeId === n.id;
        return (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`} style={{ cursor: onSelectNode ? 'pointer' : 'default' }} onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}>
            <circle r={18} fill="transparent" />
            {nodeColors && nodeColors[n.id] && <circle r={n.type === 'HOSPITAL' ? 20 : n.type === 'STATION' ? 18 : 12.5} fill="none" stroke={nodeColors[n.id]} strokeWidth={2.5} />}
            <NodeGlyph node={n} selected={selected} color={nodeColors && nodeColors[n.id]} />
            <title>{`${n.name} (${n.id}), ${label(n.type)}`}</title>
          </g>
        );
      })}

      {/* labels */}
      {showLabels &&
        graph.nodes.map((n) => {
          const big = n.type === 'HOSPITAL' || n.type === 'STATION';
          let text = n.name;
          if (n.type === 'STATION') text = n.name.replace(' Ambulance Station', '');
          if (text.length > 22) text = `${text.slice(0, 21)}...`;
          const dy = n.type === 'STATION' ? -17 : big ? 26 : 19;
          return (
            <text key={`l-${n.id}`} x={n.x} y={n.y + dy} textAnchor="middle" fontSize={big ? 11 : 9.5} fill={big ? '#e1e8f0' : '#9fb0c2'} style={halo} pointerEvents="none" fontFamily="IBM Plex Sans, sans-serif">
              {text}
            </text>
          );
        })}

      {/* notes such as tentative distances */}
      {nodeNotes &&
        Object.keys(nodeNotes).map((id) => {
          const n = nodeById[id];
          if (!n) return null;
          return (
            <g key={`note-${id}`} transform={`translate(${n.x} ${n.y - 20})`} pointerEvents="none">
              <rect x={-16} y={-8} width={32} height={14} rx={2} fill="#0b0f14" stroke="#4aa3df66" />
              <text y={3} textAnchor="middle" fontSize={9.5} fill="#9fd0f0" fontFamily="IBM Plex Mono, monospace">
                {nodeNotes[id]}
              </text>
            </g>
          );
        })}

      {/* emergencies */}
      {marker && (
        <g transform={`translate(${marker.x} ${marker.y})`} pointerEvents="none">
          <circle r={9} fill="none" stroke="#4aa3df" strokeWidth={1.5} />
          <path d="M-14 0H-4M4 0H14M0 -14V-4M0 4V14" stroke="#4aa3df" strokeWidth={1.5} />
        </g>
      )}
      {emergencies.map((e) => {
        const n = nodeById[e.nodeId];
        if (!n) return null;
        const idx = emergencyIndex[e.nodeId] || 0;
        emergencyIndex[e.nodeId] = idx + 1;
        const color = SEVERITY_COLOR[e.severity];
        const pending = e.status === 'PENDING';
        return (
          <g key={e.id} transform={`translate(${n.x + 14 + idx * 14} ${n.y - 16})`} pointerEvents="none">
            {pending && <circle r={8} fill="none" stroke={color} strokeWidth={1.5} className="marker-pulse" />}
            <path d="M0 -8L8 6H-8Z" fill={color} stroke="#0b0f14" strokeWidth={1} />
            <text y={-11} textAnchor="middle" fontSize={8.5} fill={color} style={halo} fontFamily="IBM Plex Mono, monospace">
              {e.id}
            </text>
            <title>{`${e.id}: ${e.severity} ${label(e.type)}, ${label(e.status)}`}</title>
          </g>
        );
      })}

      {/* ambulances */}
      {ambulances.map((a) => {
        if (!a.position) return null;
        let dx = 0;
        if (!a.movement) {
          const list = parked[a.nodeId] || [];
          dx = (list.indexOf(a.id) - (list.length - 1) / 2) * 24;
        }
        const color = AMBULANCE_STATUS_COLOR[a.status] || '#8593a3';
        const selected = selectedAmbulanceId === a.id;
        return (
          <g
            key={a.id}
            style={{ transform: `translate(${a.position.x + dx}px, ${a.position.y + (a.movement ? 0 : -17)}px)`, transition: 'transform 520ms linear', cursor: onSelectAmbulance ? 'pointer' : 'default' }}
            onClick={onSelectAmbulance ? () => onSelectAmbulance(a.id) : undefined}
          >
            {selected && <rect x={-14} y={-9} width={28} height={18} rx={3} fill="none" stroke="#fff" strokeWidth={1.5} />}
            <rect x={-11} y={-6} width={22} height={12} rx={2} fill={color} stroke="#0b0f14" strokeWidth={1.2} />
            <text y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#0b0f14" fontFamily="IBM Plex Mono, monospace">
              {a.id}
            </text>
            <title>{`${a.id} (${a.equipment}), ${label(a.status)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend({ className }) {
  const item = (swatch, text) => (
    <li className="flex items-center gap-2" key={text}>
      {swatch}
      <span>{text}</span>
    </li>
  );
  const box = (color, extra) => <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: color, ...extra }} />;
  return (
    <ul className={clsx('grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted', className)}>
      {item(<span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: AMBULANCE_STATUS_COLOR.AVAILABLE }} />, 'Ambulance, available')}
      {item(<span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: AMBULANCE_STATUS_COLOR.EN_ROUTE }} />, 'Ambulance, busy')}
      {item(
        <span className="relative inline-block h-4 w-4 rounded-sm bg-[#e8edf2]">
          <span className="absolute left-[7px] top-[3px] h-2.5 w-0.5 bg-[#d6403f]" />
          <span className="absolute left-[3px] top-[7px] h-0.5 w-2.5 bg-[#d6403f]" />
        </span>,
        'Hospital',
      )}
      {item(<span className="inline-block h-3.5 w-4 rounded-sm border border-accent/60 bg-accent-soft" />, 'Ambulance station')}
      {item(
        <svg width="16" height="14" viewBox="-9 -9 18 16" aria-hidden="true">
          <path d="M0 -8L8 6H-8Z" fill={SEVERITY_COLOR.CRITICAL} />
        </svg>,
        'Emergency',
      )}
      {item(<span className="inline-block h-2.5 w-2.5 rounded-full border border-muted bg-ink-700" />, 'Junction')}
      {item(box(TRAFFIC_COLOR.LOW), 'Road, normal')}
      {item(box(TRAFFIC_COLOR.MODERATE), 'Moderate traffic')}
      {item(box(TRAFFIC_COLOR.HIGH), 'Heavy traffic')}
      {item(box(TRAFFIC_COLOR.SEVERE), 'Severe traffic')}
      {item(box('transparent', { borderTop: '3px dashed #e5484d', height: 0, marginTop: 4 }), 'Closed road')}
      {item(box(ROUTE_SCENE), 'Route to scene')}
      {item(box(ROUTE_HOSPITAL), 'Route to hospital')}
    </ul>
  );
}
