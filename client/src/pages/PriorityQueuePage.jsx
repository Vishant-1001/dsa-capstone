import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLive } from '../hooks/useLive';
import ReportEmergencyModal from '../components/ReportEmergencyModal';
import { Button, Empty, Panel, SeverityTag, Spinner, Tag } from '../components/ui';
import { SEVERITY_COLOR } from '../utils/constants';
import { fmtTime, label } from '../utils/format';

const BOX_W = 92;
const BOX_H = 38;

/** Draws the heap array as the binary tree it represents. */
function HeapTree({ heap }) {
  const shown = heap.slice(0, 31);
  if (shown.length === 0) return <Empty title="The heap is empty">Report an emergency to see it inserted.</Empty>;
  const levels = Math.floor(Math.log2(shown.length)) + 1;
  const width = Math.max(640, 2 ** (levels - 1) * (BOX_W + 14));
  const height = levels * 74 + 16;
  const pos = (i) => {
    const level = Math.floor(Math.log2(i + 1));
    const idx = i - (2 ** level - 1);
    return { x: ((idx + 0.5) * width) / 2 ** level, y: 26 + level * 74 };
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Binary heap of pending emergencies" className="mx-auto block max-w-full">
        {shown.map((_, i) => {
          if (i === 0) return null;
          const a = pos(Math.floor((i - 1) / 2));
          const b = pos(i);
          return <line key={`e-${i}`} x1={a.x} y1={a.y + BOX_H / 2} x2={b.x} y2={b.y - BOX_H / 2} stroke="#3a4a5c" strokeWidth={1.5} />;
        })}
        {shown.map((h, i) => {
          const p = pos(i);
          const color = SEVERITY_COLOR[h.severity];
          return (
            <g key={h.id} transform={`translate(${p.x - BOX_W / 2} ${p.y - BOX_H / 2})`}>
              <rect width={BOX_W} height={BOX_H} rx={3} fill={`${color}22`} stroke={i === 0 ? '#4aa3df' : color} strokeWidth={i === 0 ? 2.5 : 1.2} />
              <text x={BOX_W / 2} y={16} textAnchor="middle" fontSize={12} fill="#d6dde6" fontFamily="IBM Plex Mono, monospace">
                {h.id}
              </text>
              <text x={BOX_W / 2} y={31} textAnchor="middle" fontSize={10} fill="#8593a3" fontFamily="IBM Plex Mono, monospace">
                P{h.priority} arrival #{h.seq}
              </text>
              <text x={4} y={-3} fontSize={9} fill="#5d6b7b" fontFamily="IBM Plex Mono, monospace">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
      {heap.length > shown.length && <p className="mt-2 text-center text-xs text-muted">Showing the first 31 of {heap.length} entries.</p>}
    </div>
  );
}

export default function PriorityQueuePage() {
  const { live } = useLive();
  const [report, setReport] = useState(false);
  if (!live) return <Spinner />;
  const q = live.queue;
  const head = q.ordered[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted">
          This is the real emergency priority queue. Higher severity comes out first, and ties go to the earlier arrival. Report emergencies in different orders to watch the heap reshuffle.
        </p>
        <Button variant="primary" onClick={() => setReport(true)}>
          <Plus size={16} /> Report emergency
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel px-4 py-3">
          <div className="panel-title">Queue size</div>
          <div className="mt-1 font-mono text-2xl">{q.size}</div>
        </div>
        <div className="panel px-4 py-3 lg:col-span-2">
          <div className="panel-title">Highest priority emergency</div>
          {head ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl">{head.id}</span>
              <SeverityTag severity={head.severity} />
              <span className="text-sm text-muted">
                {label(head.type)} at {head.locationName}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted">The queue is empty</div>
          )}
        </div>
        <div className="panel px-4 py-3">
          <div className="panel-title">Heap work so far</div>
          <div className="mt-1 text-sm">
            <span className="font-mono text-fg">{q.comparisons}</span> comparisons, <span className="font-mono text-fg">{q.swaps}</span> swaps
          </div>
        </div>
      </div>

      <Panel title="Queue in dequeue order" flush>
        {q.ordered.length === 0 ? (
          <Empty title="No pending emergencies" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Emergency ID</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Arrival time</th>
                  <th>Arrival order</th>
                </tr>
              </thead>
              <tbody>
                {q.ordered.map((e, i) => (
                  <tr key={e.id}>
                    <td className="font-mono text-faint">{i + 1}</td>
                    <td className="font-mono">
                      {e.id} {i === 0 && <Tag color="#4aa3df">Next out</Tag>}
                    </td>
                    <td>
                      <SeverityTag severity={e.severity} />
                    </td>
                    <td className="font-mono">{e.priority}</td>
                    <td>{label(e.type)}</td>
                    <td>{e.locationName}</td>
                    <td className="font-mono text-xs text-muted">{fmtTime(e.createdAt)}</td>
                    <td className="font-mono">{e.arrivalSeq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Heap visualization (array order drawn as a tree)">
        <HeapTree heap={q.heap} />
        {q.heap.length > 0 && (
          <p className="mt-3 break-words font-mono text-xs leading-5 text-muted">
            Array: [{q.heap.map((h) => `${h.id}:P${h.priority}`).join(', ')}]
          </p>
        )}
        <p className="mt-2 text-xs text-muted">The root (outlined in blue) is the next emergency to be dequeued. Small numbers are array indexes. A parent always outranks its children.</p>
      </Panel>

      <Panel title="Complexity">
        <ul className="grid gap-2 text-sm md:grid-cols-3">
          <li>
            Insert <span className="font-mono text-accent">O(log n)</span>
            <span className="block text-xs text-muted">Append, then sift up.</span>
          </li>
          <li>
            Remove <span className="font-mono text-accent">O(log n)</span>
            <span className="block text-xs text-muted">Swap the last item to the root, then sift down.</span>
          </li>
          <li>
            Peek <span className="font-mono text-accent">O(1)</span>
            <span className="block text-xs text-muted">Read the root.</span>
          </li>
        </ul>
      </Panel>

      {report && <ReportEmergencyModal onClose={() => setReport(false)} onCreated={() => {}} />}
    </div>
  );
}
