import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import CityMap from '../components/CityMap';
import { Button, ErrorNote, PageHeader, Panel, Select, Spinner, Tag } from '../components/ui';
import { clsx, label, pathString } from '../utils/format';

const TABS = [
  { to: '/data-structures', label: 'Overview', end: true },
  { to: '/data-structures/priority-queue', label: 'Priority queue' },
  { to: '/data-structures/dijkstra', label: 'Dijkstra visualizer' },
];

export default function DataStructures() {
  return (
    <div>
      <PageHeader
        title="Data Structures"
        subtitle="The structures and algorithms behind dispatch, with live examples taken from the running application."
      />
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line" aria-label="Data structures sections">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => clsx('-mb-px border-b-2 px-4 py-2 text-sm hover:no-underline', isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

function Concept({ name, purpose, where, complexity, children }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{name}</h2>
        {complexity && <span className="font-mono text-xs text-accent">{complexity}</span>}
      </div>
      <p className="mt-1 text-sm text-fg">{purpose}</p>
      <p className="mt-1 text-xs text-muted">{where}</p>
      <div className="mt-4 border-t border-line pt-4 text-sm">{children}</div>
    </Panel>
  );
}

const Mono = ({ children, className }) => <span className={clsx('font-mono text-xs', className)}>{children}</span>;

function Metric({ k, v }) {
  return (
    <div className="rounded border border-line bg-ink-900 px-3 py-2">
      <div className="text-2xs uppercase tracking-wider text-muted">{k}</div>
      <div className="font-mono text-base text-fg">{v}</div>
    </div>
  );
}

function HashLookup({ tables }) {
  const [table, setTable] = useState('ambulances');
  const [key, setKey] = useState('A2');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.get(`/datastructures/hash?table=${encodeURIComponent(table)}&key=${encodeURIComponent(key)}`);
      setResult(res.inspect);
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  };

  return (
    <div className="mt-4">
      <div className="panel-title mb-2">Lookup a key</div>
      <form onSubmit={run} className="flex flex-wrap items-end gap-2">
        <select className="input w-auto" value={table} onChange={(e) => setTable(e.target.value)} aria-label="Hash table">
          {tables.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.key})
            </option>
          ))}
        </select>
        <input className="input w-32 font-mono" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key" />
        <Button type="submit">Look up</Button>
      </form>
      <ErrorNote className="mt-2">{error}</ErrorNote>
      {result && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Metric k="Hash (djb2)" v={result.hash} />
          <Metric k={`Bucket of ${result.capacity}`} v={result.bucket} />
          <Metric k="Chain in bucket" v={result.chain.length ? result.chain.join(', ') : 'empty'} />
          <Metric k="Found" v={result.found ? 'yes' : 'no'} />
          {result.preview && <div className="col-span-2 break-words rounded border border-line bg-ink-900 px-3 py-2 font-mono text-2xs text-muted md:col-span-4">{JSON.stringify(result.preview)}</div>}
        </div>
      )}
    </div>
  );
}

function HashDemo() {
  const [text, setText] = useState('A1, A2, A3, A4, A5, A6, A7, A8, H1, H2');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (e) => {
    e.preventDefault();
    try {
      const keys = text.split(',').map((k) => k.trim()).filter(Boolean);
      setResult(await api.post('/datastructures/hash-demo', { keys }));
      setError('');
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  };

  return (
    <div className="mt-6">
      <div className="panel-title mb-2">Build a table step by step</div>
      <p className="mb-2 text-xs text-muted">Keys go into a fresh table that starts with 4 buckets. Watch collisions form chains and the table double when the load factor passes 0.75.</p>
      <form onSubmit={run} className="flex flex-wrap items-end gap-2">
        <input className="input min-w-[16rem] flex-1 font-mono" value={text} onChange={(e) => setText(e.target.value)} aria-label="Comma separated keys" />
        <Button type="submit">Insert keys</Button>
      </form>
      <ErrorNote className="mt-2">{error}</ErrorNote>
      {result && (
        <div className="mt-3 space-y-3">
          <div className="max-h-64 overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Key</th>
                  <th className="text-right">Hash</th>
                  <th className="text-right">Bucket</th>
                  <th className="text-right">Chain</th>
                  <th className="text-right">Load</th>
                  <th className="text-right">Buckets</th>
                </tr>
              </thead>
              <tbody>
                {result.steps.map((s, i) => (
                  <tr key={`${s.key}-${i}`}>
                    <td className="font-mono text-xs">{s.key}</td>
                    <td className="text-right font-mono">{s.hash}</td>
                    <td className="text-right font-mono">{s.bucket}</td>
                    <td className="text-right font-mono">{s.chainLength > 1 ? `${s.chainLength} (collision)` : s.chainLength}</td>
                    <td className="text-right font-mono">{s.loadFactor}</td>
                    <td className="text-right font-mono">
                      {s.capacity}
                      {s.resized && <span className="ml-2 text-warn">resized</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-1 text-2xs sm:grid-cols-4">
            {result.layout.map((b) => (
              <div key={b.index} className="rounded border border-line bg-ink-900 px-2 py-1">
                <span className="font-mono text-faint">[{b.index}]</span> <span className="font-mono text-fg">{b.keys.length ? b.keys.join(' > ') : 'empty'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BfsExplorer() {
  const { graph, live } = useLive();
  const [start, setStart] = useState('ST1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const nodes = useMemo(() => (graph ? graph.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)) : []), [graph]);

  const run = useCallback(async () => {
    try {
      const res = await api.post('/routes/bfs', { start });
      setResult(res.bfs);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [start]);

  const signature = live ? live.roads.map((r) => (r.isClosed ? 'x' : 'o')).join('') : '';
  useEffect(() => {
    run();
  }, [run, signature]);

  const colors = {};
  const notes = {};
  if (result) {
    result.order.forEach((id) => { notes[id] = String(result.hops[id]); colors[id] = '#3fb68b'; });
    result.unreachable.forEach((id) => { colors[id] = '#e5484d'; });
    colors[start] = '#4aa3df';
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <Select className="input w-auto" value={start} onChange={(e) => setStart(e.target.value)} aria-label="BFS start node">
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.id})
            </option>
          ))}
        </Select>
        <Button onClick={run}>Run BFS</Button>
      </div>
      <ErrorNote className="mt-2">{error}</ErrorNote>
      {result && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric k="Reachable" v={`${result.reachableCount} of ${nodes.length}`} />
            <Metric k="Unreachable" v={result.unreachable.length} />
            <Metric k="Closed roads" v={live ? live.kpis.closedRoads : 0} />
          </div>
          <p className="mt-3 break-words font-mono text-2xs leading-5 text-muted">Visit order: {pathString(result.order)}</p>
          {result.unreachable.length > 0 && <p className="mt-1 text-xs text-crit">Cut off by closures: {result.unreachable.join(', ')}</p>}
          <div className="mt-3 aspect-[1000/620] w-full overflow-hidden rounded border border-line">
            <CityMap graph={graph} live={live} showLabels={false} showAmbulances={false} showEmergencies={false} nodeColors={colors} nodeNotes={notes} />
          </div>
          <p className="mt-2 text-xs text-muted">Numbers are hops from the start node. Red rings mark nodes that cannot be reached over open roads.</p>
        </>
      )}
    </div>
  );
}

export function DataStructuresOverview() {
  const { live } = useLive();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/datastructures')
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 2000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;
  const g = data.graph;
  const pq = data.priorityQueue;

  return (
    <div className="space-y-5">
      <ErrorNote>{error}</ErrorNote>
      <div className="grid gap-5 xl:grid-cols-2">
        <Concept name="Graph" purpose="Represents the city road network." where="Vertices are junctions, buildings, ambulance stations and hospitals. Edges are two-way roads with distance, normal and current travel time, traffic level and a closed flag." complexity="Space O(V + E)">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric k="Vertices V" v={g.vertices} />
            <Metric k="Edges E" v={g.edges} />
            <Metric k="Adjacency entries" v={g.adjacencyEntries} />
            <Metric k="Components" v={g.components} />
          </div>
          <p className="mt-3 text-xs text-muted">Each road is stored once and listed in the adjacency list of both endpoints, so the lists hold 2E entries. Closed roads: {g.closedRoads}.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Adjacency list (neighbour, minutes)</th>
                </tr>
              </thead>
              <tbody>
                {g.sample.map((n) => (
                  <tr key={n.id}>
                    <td className="font-mono text-xs">{n.id}</td>
                    <td className="font-mono text-2xs text-muted">
                      {n.neighbors.map((x) => `${x.to}${x.closed ? ' (closed)' : ` ${x.time}`}`).join('  |  ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Concept>

        <Concept name="Priority queue" purpose="Orders emergencies so the most urgent is dispatched first." where="Severity maps to priority: Critical 10, High 7, Medium 5, Low 2. Equal priorities are served in arrival order." complexity="enqueue and dequeue O(log n), peek O(1)">
          <div className="grid grid-cols-3 gap-2">
            <Metric k="Queue size" v={pq.size} />
            <Metric k="Highest priority" v={pq.head ? pq.head.id : 'empty'} />
            <Metric k="Severity" v={pq.head ? pq.head.severity : 'n/a'} />
          </div>
          <p className="mt-3 text-xs text-muted">The queue below is the live content, in dequeue order.</p>
          <ol className="mt-2 space-y-1">
            {pq.ordered.length === 0 && <li className="text-xs text-faint">No pending emergencies. Report one to see it enter the queue.</li>}
            {pq.ordered.map((e, i) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span className="w-5 font-mono text-faint">{i + 1}</span>
                <Mono className="text-fg">{e.id}</Mono>
                <Tag>{e.severity}</Tag>
                <span className="text-muted">priority {e.priority}, arrival #{e.arrivalSeq}</span>
              </li>
            ))}
          </ol>
          <NavLink to="/data-structures/priority-queue" className="mt-3 inline-block text-xs">
            Open the queue and heap visualizer
          </NavLink>
        </Concept>

        <Concept name="Min heap" purpose="Backs both the priority queue and Dijkstra's frontier." where="A binary heap in an array: the parent of index i is floor((i - 1) / 2) and its children are 2i + 1 and 2i + 2. Inserts sift up, extractions sift down." complexity="insert and extractMin O(log n)">
          <p className="text-xs text-muted">Emergency heap, in array order (priority, arrival):</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pq.heap.length === 0 && <span className="text-xs text-faint">Empty</span>}
            {pq.heap.map((h, i) => (
              <span key={h.id} className="rounded border border-line bg-ink-900 px-2 py-1 font-mono text-2xs text-fg">
                [{i}] {h.id} ({h.priority}, #{h.seq})
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric k="Comparisons so far" v={pq.comparisons} />
            <Metric k="Swaps so far" v={pq.swaps} />
          </div>
          <p className="mt-2 text-xs text-muted">{data.minHeapUse}</p>
        </Concept>

        <Concept name="Hash table" purpose="Constant-time lookup of ambulances, hospitals, emergencies, missions and graph nodes by id." where="Separate chaining with the djb2 hash. The table doubles when the load factor passes 0.75." complexity="Average O(1) lookup">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Key</th>
                  <th className="text-right">Size</th>
                  <th className="text-right">Buckets</th>
                  <th className="text-right">Load</th>
                  <th className="text-right">Longest chain</th>
                </tr>
              </thead>
              <tbody>
                {data.hashTables.map((t) => (
                  <tr key={t.name}>
                    <td className="font-mono text-xs">{t.name}</td>
                    <td className="text-xs text-muted">{t.key}</td>
                    <td className="text-right font-mono">{t.stats.size}</td>
                    <td className="text-right font-mono">{t.stats.capacity}</td>
                    <td className="text-right font-mono">{t.stats.loadFactor}</td>
                    <td className="text-right font-mono">{t.stats.longestChain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HashLookup tables={data.hashTables} />
          <HashDemo />
        </Concept>

        <Concept name="Stack" purpose="Rebuilds a shortest path in forward order." where="Dijkstra stores only predecessor links. Walking back from the destination pushes each node on a stack, and popping yields the route from source to destination." complexity="push and pop O(1)">
          {data.stack ? (
            <div className="space-y-2 text-xs">
              <p className="text-muted">
                {data.stack.sample ? 'Sample route' : 'Latest route'} {data.stack.source} to {data.stack.target}
              </p>
              <div>
                <div className="panel-title mb-1">Pushed (destination first)</div>
                <p className="break-words font-mono text-2xs leading-5 text-fg">{pathString(data.stack.pushed)}</p>
              </div>
              <div>
                <div className="panel-title mb-1">Popped (source first)</div>
                <p className="break-words font-mono text-2xs leading-5 text-accent">{pathString(data.stack.popped)}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-faint">No route has been calculated yet.</p>
          )}
        </Concept>

        <Concept name="Queue" purpose="Processes simulation events in first-in, first-out order." where="Arrivals, dispatches, reroutes and completions are enqueued as they happen and dequeued in order to become notifications. BFS also uses a queue." complexity="enqueue and dequeue O(1)">
          <div className="grid grid-cols-2 gap-2">
            <Metric k="Events waiting" v={data.queue.size} />
            <Metric k="Processed recently" v={data.queue.processed.length} />
          </div>
          <div className="mt-3 space-y-1">
            {data.queue.processed
              .slice()
              .reverse()
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted">#{e.id}</span>
                  <span className="text-fg">{label(e.type)}</span>
                </div>
              ))}
            {data.queue.processed.length === 0 && <p className="text-xs text-faint">No events yet. Actions in the application produce events here.</p>}
          </div>
        </Concept>
      </div>

      <Concept name="Breadth-first search" purpose="Checks whether a destination is still reachable after road closures." where="Before rerouting, BFS runs from the ambulance's current node over open roads. If the destination is not visited, the mission reports DESTINATION CURRENTLY UNREACHABLE instead of calling Dijkstra." complexity="O(V + E)">
        <BfsExplorer />
      </Concept>

      <Panel title="Complexity" flush>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Complexity</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Dijkstra shortest path', 'O((V + E) log V)', 'Binary heap with lazy deletion. Each edge is relaxed at most once per direction.'],
                ['Priority queue insert', 'O(log n)', 'Sift up through at most log2(n) levels.'],
                ['Priority queue remove', 'O(log n)', 'Replace the root with the last item and sift down.'],
                ['Priority queue peek', 'O(1)', 'The root of the heap.'],
                ['Hash table lookup', 'Average O(1)', 'Worst case O(n) if every key lands in one bucket. Resizing keeps chains short.'],
                ['BFS', 'O(V + E)', 'Every node is enqueued once and every edge examined once.'],
                ['Adjacency list', 'O(V + E) space', 'Better than an adjacency matrix, O(V squared), for a sparse road network.'],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td className="font-mono text-accent">{b}</td>
                  <td className="text-muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3 text-xs text-muted">
          V is the number of vertices (nodes) in the graph, currently {g.vertices}. E is the number of edges (roads), currently {g.edges}. n is the number of items held by the structure in question.
        </div>
      </Panel>
    </div>
  );
}
