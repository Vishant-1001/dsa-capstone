const { runtime, emit } = require('./runtime');
const traffic = require('./traffic');
const { badRequest } = require('../utils/errors');

// Hubs are map nodes. A road takes the heaviest level of its two end nodes.
const PRESETS = {
  MORNING_PEAK: { label: 'Morning peak', HIGH: ['N07', 'N03', 'N09', 'N08'], MODERATE: ['N15', 'N04', 'N06'] },
  EVENING_PEAK: { label: 'Evening peak', HIGH: ['N15', 'N14', 'N16', 'N21'], MODERATE: ['N09', 'N13', 'N17'] },
  CLEAR: { label: 'Clear all traffic', HIGH: [], MODERATE: [] },
};

function levelFor(preset, edge) {
  const ends = [edge.source, edge.destination];
  if (ends.some((n) => preset.HIGH.includes(n))) return 'HIGH';
  if (ends.some((n) => preset.MODERATE.includes(n))) return 'MODERATE';
  return 'LOW';
}

function list() {
  return Object.keys(PRESETS).map((id) => ({ id, label: PRESETS[id].label }));
}

/** Sets every road to the level the preset gives it, then reroutes ambulances once per change. */
function apply(name, user) {
  const preset = PRESETS[name];
  if (!preset) throw badRequest(`Preset must be one of: ${Object.keys(PRESETS).join(', ')}`);
  const roads = runtime.graph.allEdges().sort((a, b) => (a.id < b.id ? -1 : 1));
  const effects = [];
  let changed = 0;
  roads.forEach((edge) => {
    const level = levelFor(preset, edge);
    if (edge.trafficLevel !== level) {
      effects.push(...traffic.setTraffic(edge.id, level, user, { quiet: true }).effects);
      changed += 1;
    }
  });
  emit('TRAFFIC_PRESET', changed ? 'warning' : 'info', preset.label, `${changed} road${changed === 1 ? '' : 's'} changed.`, {});
  return { preset: name, label: preset.label, changedRoads: changed, effects };
}

module.exports = { list, apply, PRESETS };
