const live = require('../services/live');
const simControl = require('../services/simControl');
const demo = require('../services/demo');
const { runtime } = require('../services/runtime');
const { db } = require('../models/factory');

exports.live = (req, res) => res.json(live.snapshot());

exports.setOptions = (req, res) => res.json(simControl.setOptions(req.body || {}));

exports.startDemo = (req, res) => res.status(201).json({ demo: demo.start() });
exports.stopDemo = (req, res) => res.json({ demo: demo.stop() });

exports.reset = (req, res) => {
  simControl.resetCity();
  res.json({ ok: true });
};

exports.health = (req, res) => {
  let database = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    database = 'unavailable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.round(process.uptime()),
    simulation: { paused: runtime.paused, speed: runtime.speed, activeMissions: runtime.missions.size() },
  });
};
