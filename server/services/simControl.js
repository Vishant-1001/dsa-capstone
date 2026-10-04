const { settings } = require('../models/system');
const { db } = require('../models/factory');
const { runtime, load } = require('./runtime');
const demo = require('./demo');
const { badRequest } = require('../utils/errors');

const SPEEDS = [1, 2, 4];

function setOptions(input) {
  if (input.speed !== undefined) {
    const speed = Number(input.speed);
    if (!SPEEDS.includes(speed)) throw badRequest(`Speed must be one of ${SPEEDS.map((s) => `${s}x`).join(', ')}`);
    runtime.speed = speed;
    settings.set('sim_speed', speed);
  }
  if (input.paused !== undefined) {
    if (typeof input.paused !== 'boolean') throw badRequest('paused must be true or false');
    runtime.paused = input.paused;
    settings.set('sim_paused', input.paused ? '1' : '0');
  }
  if (input.autoDispatch !== undefined) {
    if (typeof input.autoDispatch !== 'boolean') throw badRequest('autoDispatch must be true or false');
    runtime.autoDispatch = input.autoDispatch;
    settings.set('auto_dispatch', input.autoDispatch ? '1' : '0');
  }
  if (input.autoReturn !== undefined) {
    if (typeof input.autoReturn !== 'boolean') throw badRequest('autoReturn must be true or false');
    runtime.autoReturn = input.autoReturn;
    settings.set('auto_return', input.autoReturn ? '1' : '0');
  }
  return { speed: runtime.speed, paused: runtime.paused, autoDispatch: runtime.autoDispatch, autoReturn: runtime.autoReturn };
}

/** Restores the demo city and clears emergencies, missions and traffic history. Accounts are kept. */
function resetCity() {
  demo.stop();
  runtime.demo = null;
  const { resetCity: reset } = require('../../database/seed');
  reset(db);
  load();
}

module.exports = { setOptions, resetCity };
