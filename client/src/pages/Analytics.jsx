import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';
import { Empty, ErrorNote, PageHeader, Panel, Spinner, Stat } from '../components/ui';
import { SEVERITY_COLOR } from '../utils/constants';
import { fmtKm, fmtMin, label } from '../utils/format';

const AXIS = '#5d6b7b';
const GRID = '#223040';
const ACCENT = '#4aa3df';
const tooltipProps = {
  contentStyle: { background: '#16202b', border: '1px solid #273748', borderRadius: 4, fontSize: 12 },
  labelStyle: { color: '#d6dde6' },
  itemStyle: { color: '#d6dde6' },
  cursor: { fill: '#ffffff10' },
};

function ChartCard({ title, note, empty, children, className }) {
  return (
    <Panel title={title} className={className}>
      {empty ? (
        <Empty title="No data yet">{empty}</Empty>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        </>
      )}
    </Panel>
  );
}

const axisProps = { stroke: AXIS, tick: { fill: '#8593a3', fontSize: 11 }, tickLine: false };

export default function Analytics() {
  const { live } = useLive();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const version = live ? `${live.kpis.completedMissions}-${live.kpis.totalEmergencies}-${live.kpis.closedRoads}` : '';

  useEffect(() => {
    api
      .get('/analytics')
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [version]);

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  const t = data.totals;
  const noMissions = t.completedMissions === 0;
  const typeData = data.typeDistribution.map((x) => ({ ...x, name: label(x.type) }));
  const severityData = data.severityDistribution.map((x) => ({ ...x, name: label(x.severity) }));
  const responseData = data.responseBySeverity.filter((x) => x.missions > 0).map((x) => ({ ...x, name: label(x.severity) }));
  const timeData = data.missionsOverTime.map((x) => ({ count: x.count, name: x.bucket.slice(11) }));
  const impact = data.trafficImpact;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Computed from stored emergencies, missions and traffic events. Times are simulation minutes." />
      <ErrorNote className="mb-4">{error}</ErrorNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Emergencies" value={t.emergencies} />
        <Stat label="Missions completed" value={t.completedMissions} hint={t.cancelledMissions ? `${t.cancelledMissions} cancelled` : undefined} />
        <Stat label="Avg response time" value={t.avgResponseTime === null ? 'n/a' : fmtMin(t.avgResponseTime)} />
        <Stat label="Avg travel time" value={t.avgTravelTime === null ? 'n/a' : fmtMin(t.avgTravelTime)} />
        <Stat label="Distance driven" value={fmtKm(t.totalDistance)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Emergency severity distribution" empty={t.emergencies === 0 ? 'Report an emergency to populate this chart.' : null}>
          <BarChart data={severityData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" name="Emergencies" radius={[2, 2, 0, 0]}>
              {severityData.map((d) => (
                <Cell key={d.severity} fill={SEVERITY_COLOR[d.severity]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Emergency type distribution" empty={t.emergencies === 0 ? 'Report an emergency to populate this chart.' : null}>
          <BarChart data={typeData} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="name" width={90} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" name="Emergencies" fill={ACCENT} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Average response time by severity" note="Response time runs from the report to arrival at the scene." empty={noMissions ? 'Complete a mission to see response times.' : null}>
          <BarChart data={responseData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis unit=" min" {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(v, n, p) => [`${v} min (${p.payload.missions} missions)`, 'Average']} />
            <Bar dataKey="avgResponse" name="Average" maxBarSize={64} radius={[2, 2, 0, 0]}>
              {responseData.map((d) => (
                <Cell key={d.severity} fill={SEVERITY_COLOR[d.severity]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Response and travel time per mission" note="Most recent 20 completed missions." empty={noMissions ? 'Complete a mission to see the trend.' : null}>
          <LineChart data={data.responseTrend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mission" {...axisProps} />
            <YAxis unit=" min" {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8593a3' }} />
            <Line type="monotone" dataKey="responseTime" name="Response time" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="travelTime" name="Travel time" stroke="#3fb68b" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Ambulance utilization" note="Share of simulated time each unit spent on completed missions." empty={noMissions ? 'Complete a mission to see utilization.' : null}>
          <BarChart data={data.ambulanceUtilization} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="id" {...axisProps} />
            <YAxis unit="%" domain={[0, 100]} {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(v, n, p) => [`${v}% (${p.payload.missions} missions, ${p.payload.distance} km)`, 'Utilization']} />
            <Bar dataKey="utilization" name="Utilization" fill={ACCENT} maxBarSize={56} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Hospital usage" note="Patients delivered by completed missions." empty={noMissions ? 'Complete a mission to see hospital usage.' : null}>
          <BarChart data={data.hospitalUsage} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="id" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipProps} formatter={(v, n, p) => [`${v} patients, ${p.payload.occupancy}% beds occupied`, p.payload.name]} />
            <Bar dataKey="patients" name="Patients" fill="#3fb68b" maxBarSize={56} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Missions completed over time" note="Counted in ten minute intervals of wall-clock time." empty={noMissions ? 'Complete a mission to see this chart.' : null}>
          <BarChart data={timeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" name="Missions" fill={ACCENT} maxBarSize={56} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Traffic impact: planned versus actual travel" note="Planned time is the first Dijkstra estimate. Actual time includes slowdowns and waiting after reroutes." empty={impact.missions.length === 0 ? 'Complete a mission to compare planned and actual times.' : null}>
          <BarChart data={impact.missions} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mission" {...axisProps} />
            <YAxis unit=" min" {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8593a3' }} />
            <Bar dataKey="planned" name="Planned" fill="#5d6b7b" maxBarSize={36} radius={[2, 2, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="#e0a93a" maxBarSize={36} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <Panel title="Traffic summary" className="mt-5">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-muted">Road changes</div>
            <div className="font-mono text-xl">{(impact.events.TRAFFIC_CHANGE || 0) + (impact.events.ROAD_CLOSED || 0)}</div>
          </div>
          <div>
            <div className="text-muted">Reroutes</div>
            <div className="font-mono text-xl">{impact.reroutes}</div>
          </div>
          <div>
            <div className="text-muted">Missions delayed</div>
            <div className="font-mono text-xl">{impact.delayedMissions}</div>
          </div>
          <div>
            <div className="text-muted">Total delay</div>
            <div className="font-mono text-xl">{fmtMin(impact.totalDelay)}</div>
          </div>
        </div>
        {impact.mostChangedRoads.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Most changed roads: {impact.mostChangedRoads.map((r) => `${r.roadId} (${r.changes})`).join(', ')}
          </p>
        )}
      </Panel>
    </div>
  );
}
