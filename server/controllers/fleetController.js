const fleet = require('../services/fleet');
const dispatch = require('../services/dispatch');
const { nodeName } = require('../services/runtime');

exports.listAmbulances = (req, res) => res.json({ ambulances: fleet.listAmbulances() });
exports.getAmbulance = (req, res) => res.json(fleet.getAmbulance(req.params.id));
exports.createAmbulance = (req, res) => res.status(201).json({ ambulance: fleet.createAmbulance(req.body || {}) });
exports.updateAmbulance = (req, res) => res.json({ ambulance: fleet.updateAmbulance(req.params.id, req.body || {}) });
exports.returnAmbulance = (req, res) => {
  const a = dispatch.returnToStation(req.params.id);
  res.json({ ambulance: { ...a, locationName: nodeName(a.nodeId) } });
};

exports.listHospitals = (req, res) => res.json({ hospitals: fleet.listHospitals() });
exports.createHospital = (req, res) => res.status(201).json({ hospital: fleet.createHospital(req.body || {}) });
exports.updateHospital = (req, res) => res.json({ hospital: fleet.updateHospital(req.params.id, req.body || {}) });
