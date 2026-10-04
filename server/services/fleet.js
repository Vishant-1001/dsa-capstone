const { stmt } = require('../models/factory');
const { ambulances, hospitals } = require('../models/fleet');
const { runtime, saveAmbulance, saveHospital, nodeName, now } = require('./runtime');
const missionQuery = require('./missionQuery');
const flow = require('./missionFlow');
const { oneOf, text, number, identifier } = require('../utils/validate');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { EQUIPMENT, SPECIALTIES } = require('../constants');

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* -------------------------------- ambulances ------------------------------- */

function decorateAmbulance(a, completed) {
  return {
    ...a,
    locationName: nodeName(a.nodeId),
    homeStationName: a.homeStationId ? nodeName(a.homeStationId) : null,
    completedMissions: completed[a.id] || 0,
  };
}

function completedByAmbulance() {
  const out = {};
  stmt("SELECT ambulance_id, COUNT(*) AS c FROM missions WHERE status = 'COMPLETED' GROUP BY ambulance_id").all().forEach((r) => { out[r.ambulance_id] = r.c; });
  return out;
}

function listAmbulances() {
  const completed = completedByAmbulance();
  return runtime.ambulances.values().sort(byId).map((a) => decorateAmbulance(a, completed));
}

function getAmbulance(id) {
  const a = runtime.ambulances.get(id);
  if (!a) throw notFound(`Ambulance ${id} not found`);
  return {
    ambulance: decorateAmbulance(a, completedByAmbulance()),
    history: missionQuery.list({ ambulanceId: id, limit: 10 }),
  };
}

function requireNode(id, label) {
  const node = runtime.graph.getNode(id);
  if (!node) throw badRequest(`${label} ${id} is not on the map`);
  return node;
}

function createAmbulance(input) {
  const id = identifier(input.id, 'Ambulance ID').toUpperCase();
  if (runtime.ambulances.has(id)) throw conflict('DUPLICATE_ID', `Ambulance ${id} already exists`);
  const equipment = oneOf(input.equipment, EQUIPMENT, 'Equipment');
  const nodeId = text(input.nodeId, 'Location', { max: 24 });
  const here = requireNode(nodeId, 'Location');
  let home = input.homeStationId ? text(input.homeStationId, 'Home station', { max: 24 }) : null;
  if (!home && here.type === 'STATION') home = nodeId;
  if (home && requireNode(home, 'Home station').type !== 'STATION') throw badRequest('Home station must be an ambulance station');
  const name = text(input.name, 'Name', { required: false, max: 40 }) || `Unit ${id}`;
  const stamp = now();
  ambulances.insert({ id, name, nodeId, homeStationId: home, status: 'AVAILABLE', equipment, distanceTravelled: 0, createdAt: stamp, updatedAt: stamp });
  runtime.ambulances.set(id, ambulances.get(id));
  return decorateAmbulance(runtime.ambulances.get(id), {});
}

function updateAmbulance(id, input) {
  const a = runtime.ambulances.get(id);
  if (!a) throw notFound(`Ambulance ${id} not found`);
  const patch = {};
  const onMission = Boolean(a.currentMissionId) || !['AVAILABLE', 'OFFLINE'].includes(a.status);

  if (input.name !== undefined) patch.name = text(input.name, 'Name', { max: 40 });
  if (input.equipment !== undefined) {
    if (onMission) throw conflict('ON_MISSION', `${id} is ${a.status}. Equipment can only change while it is available or offline.`);
    patch.equipment = oneOf(input.equipment, EQUIPMENT, 'Equipment');
  }
  if (input.nodeId !== undefined) {
    if (onMission) throw conflict('ON_MISSION', `${id} is ${a.status}. Location can only change while it is available or offline.`);
    requireNode(input.nodeId, 'Location');
    patch.nodeId = input.nodeId;
  }
  if (input.homeStationId !== undefined && input.homeStationId !== null && input.homeStationId !== '') {
    if (requireNode(input.homeStationId, 'Home station').type !== 'STATION') throw badRequest('Home station must be an ambulance station');
    patch.homeStationId = input.homeStationId;
  }
  if (input.status !== undefined) {
    const status = oneOf(input.status, ['AVAILABLE', 'OFFLINE'], 'Status');
    if (status === 'OFFLINE' && a.status !== 'AVAILABLE') {
      throw conflict('ON_MISSION', `${id} is ${a.status}. Only an available ambulance can be set offline.`);
    }
    if (status === 'AVAILABLE' && a.status !== 'OFFLINE') {
      throw conflict('NOT_OFFLINE', `${id} is ${a.status}. Only an offline ambulance can be set available.`);
    }
    patch.status = status;
  }
  saveAmbulance(id, patch);
  return decorateAmbulance(runtime.ambulances.get(id), completedByAmbulance());
}

/* -------------------------------- hospitals -------------------------------- */

function decorateHospital(h, inbound) {
  return { ...h, locationName: nodeName(h.nodeId), inbound: inbound[h.id] || 0 };
}

function listHospitals() {
  const inbound = flow.inboundCounts(null);
  return flow.hospitalList().map((h) => decorateHospital(h, inbound));
}

function parseSpecialties(value) {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('Select at least one specialty');
  const unique = Array.from(new Set(value.map((s) => oneOf(s, SPECIALTIES, 'Specialty'))));
  return unique.sort();
}

function createHospital(input) {
  const id = identifier(input.id, 'Hospital ID').toUpperCase();
  if (runtime.hospitals.has(id)) throw conflict('DUPLICATE_ID', `Hospital ${id} already exists`);
  const name = text(input.name, 'Name', { max: 80 });
  const nodeId = text(input.nodeId, 'Location', { max: 24 });
  const node = requireNode(nodeId, 'Location');
  if (node.type !== 'HOSPITAL') throw badRequest('Location must be a node of type HOSPITAL');
  if (runtime.hospitals.values().some((h) => h.nodeId === nodeId)) throw conflict('NODE_IN_USE', `${nodeName(nodeId)} already has a hospital`);
  const totalBeds = number(input.totalBeds, 'Total beds', { min: 0, max: 5000, integer: true });
  const availableBeds = input.availableBeds === undefined || input.availableBeds === '' ? totalBeds : number(input.availableBeds, 'Available beds', { min: 0, max: totalBeds, integer: true });
  const specialties = parseSpecialties(input.specialties);
  const stamp = now();
  hospitals.insert({ id, name, nodeId, totalBeds, availableBeds, status: 'OPEN', createdAt: stamp, updatedAt: stamp });
  hospitals.setSpecialties(id, specialties);
  runtime.hospitals.set(id, hospitals.get(id));
  return decorateHospital(runtime.hospitals.get(id), {});
}

function updateHospital(id, input) {
  const h = runtime.hospitals.get(id);
  if (!h) throw notFound(`Hospital ${id} not found`);
  const patch = {};
  if (input.name !== undefined) patch.name = text(input.name, 'Name', { max: 80 });
  if (input.status !== undefined) patch.status = oneOf(input.status, ['OPEN', 'CLOSED'], 'Status');
  if (input.specialties !== undefined) patch.specialties = parseSpecialties(input.specialties);

  const total = input.totalBeds !== undefined ? number(input.totalBeds, 'Total beds', { min: 0, max: 5000, integer: true }) : h.totalBeds;
  const available = input.availableBeds !== undefined ? number(input.availableBeds, 'Available beds', { min: 0, max: 5000, integer: true }) : h.availableBeds;
  if (available > total) throw badRequest('Available beds cannot exceed total beds');
  if (input.totalBeds !== undefined) patch.totalBeds = total;
  if (input.availableBeds !== undefined) patch.availableBeds = available;

  saveHospital(id, patch);
  return decorateHospital(runtime.hospitals.get(id), flow.inboundCounts(null));
}

module.exports = { listAmbulances, getAmbulance, createAmbulance, updateAmbulance, listHospitals, createHospital, updateHospital };
