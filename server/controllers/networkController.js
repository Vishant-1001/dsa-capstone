const { stmt } = require('../models/factory');
const { runtime } = require('../services/runtime');
const traffic = require('../services/traffic');
const graphService = require('../services/graphService');
const analytics = require('../services/analytics');
const dsInfo = require('../services/dsInfo');
const { dijkstra } = require('../algorithms/dijkstra');
const { astar } = require('../algorithms/astar');
const trafficPresets = require('../services/trafficPresets');
const exportsService = require('../services/exports');
const { bfs } = require('../algorithms/bfs');
const { badRequest } = require('../utils/errors');
const { oneOf, text } = require('../utils/validate');
const { TRAFFIC_LEVELS } = require('../constants');

exports.calculateRoute = (req, res) => {
  const body = req.body || {};
  const source = text(body.source, 'Source', { max: 24 });
  const target = text(body.target, 'Destination', { max: 24 });
  if (!runtime.graph.hasNode(source)) throw badRequest(`Node ${source} is not on the map`);
  if (!runtime.graph.hasNode(target)) throw badRequest(`Node ${target} is not on the map`);
  const weight = body.weight === 'distance' ? 'distance' : 'time';
  const route = dijkstra(runtime.graph, source, target, { weight, trace: Boolean(body.trace) });
  if (route.found) {
    runtime.lastStackTrace = { source, target, pushed: route.stackTrace.pushed, popped: route.stackTrace.popped, sample: false };
  }
  res.json({ route });
};

exports.reachability = (req, res) => {
  const start = text(req.body && req.body.start, 'Start node', { max: 24 });
  if (!runtime.graph.hasNode(start)) throw badRequest(`Node ${start} is not on the map`);
  const result = bfs(runtime.graph, start);
  const unreachable = runtime.graph.allNodes().map((n) => n.id).filter((id) => !Object.prototype.hasOwnProperty.call(result.hops, id)).sort();
  res.json({ bfs: { ...result, unreachable } });
};

exports.getTraffic = (req, res) => {
  const roads = runtime.graph.allEdges().map(traffic.serializeRoad).sort((a, b) => (a.id < b.id ? -1 : 1));
  const events = stmt('SELECT * FROM traffic_events ORDER BY id DESC LIMIT 40').all().map((r) => ({
    id: r.id,
    type: r.event_type,
    roadId: r.road_id,
    oldLevel: r.old_level,
    newLevel: r.new_level,
    missionId: r.mission_id,
    etaBefore: r.eta_before,
    etaAfter: r.eta_after,
    details: r.details,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
  res.json({ roads, events, levels: TRAFFIC_LEVELS });
};

exports.setTraffic = (req, res) => {
  const level = oneOf(req.body && req.body.level, TRAFFIC_LEVELS, 'Traffic level');
  res.json(traffic.setTraffic(req.params.roadId, level, req.user));
};

exports.closeRoad = (req, res) => res.json(traffic.closeRoad(req.params.roadId, req.user));
exports.reopenRoad = (req, res) => res.json(traffic.reopenRoad(req.params.roadId, req.user));

exports.getGraph = (req, res) => res.json(graphService.snapshot());
exports.addNode = (req, res) => res.status(201).json(graphService.addNode(req.body || {}));
exports.addRoad = (req, res) => res.status(201).json(graphService.addRoad(req.body || {}, req.user));

exports.analytics = (req, res) => res.json(analytics.fullAnalytics());

exports.compareRoutes = (req, res) => {
  const body = req.body || {};
  const source = text(body.source, 'Source', { max: 24 });
  const target = text(body.target, 'Destination', { max: 24 });
  if (!runtime.graph.hasNode(source)) throw badRequest(`Node ${source} is not on the map`);
  if (!runtime.graph.hasNode(target)) throw badRequest(`Node ${target} is not on the map`);
  const slim = ({ steps, stackTrace, ...rest }) => rest;
  res.json({ dijkstra: slim(dijkstra(runtime.graph, source, target)), astar: astar(runtime.graph, source, target) });
};

exports.applyPreset = (req, res) => res.json(trafficPresets.apply(req.body && req.body.preset, req.user));
exports.listPresets = (req, res) => res.json({ presets: trafficPresets.list() });

const sendCsv = (res, name, body) => {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
  res.send(body);
};
exports.exportMissions = (req, res) => sendCsv(res, 'missions.csv', exportsService.missionsCsv());
exports.exportTraffic = (req, res) => sendCsv(res, 'traffic-events.csv', exportsService.trafficEventsCsv());

exports.hashDemo = (req, res) => res.json(dsInfo.hashDemo(req.body && req.body.keys));

exports.dataStructures = (req, res) => res.json(dsInfo.overview());
exports.inspectHash = (req, res) => res.json({ inspect: dsInfo.inspectHash(req.query.table, req.query.key) });
