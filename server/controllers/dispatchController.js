const dispatch = require('../services/dispatch');
const missionQuery = require('../services/missionQuery');

exports.recommendation = (req, res) => res.json({ recommendation: dispatch.recommend(req.params.emergencyId) });

exports.dispatch = (req, res) => {
  const result = dispatch.dispatch(req.params.emergencyId, { override: Boolean(req.body && req.body.override) }, req.user);
  res.status(201).json(result);
};

exports.dispatchNext = (req, res) => res.status(201).json(dispatch.dispatchNext(req.user));

exports.listMissions = (req, res) => res.json({ missions: missionQuery.list(req.query) });

exports.getMission = (req, res) => res.json({ mission: missionQuery.detail(req.params.id) });

exports.hospitalOptions = (req, res) => res.json({ selection: dispatch.hospitalOptions(req.params.id) });

exports.pickup = (req, res) => {
  const body = req.body || {};
  const result = dispatch.pickup(req.params.id, { hospitalId: body.hospitalId });
  res.json({ mission: missionQuery.detail(result.mission.id), selection: result.selection });
};

exports.complete = (req, res) => {
  const mission = dispatch.completeNow(req.params.id);
  res.json({ mission: missionQuery.detail(mission.id) });
};
