const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../middleware/auth');
const authC = require('../controllers/authController');
const emergencyC = require('../controllers/emergencyController');
const fleetC = require('../controllers/fleetController');
const dispatchC = require('../controllers/dispatchController');
const networkC = require('../controllers/networkController');
const systemC = require('../controllers/systemController');
const resourceC = require('../controllers/resourceController');

const router = express.Router();
const ADMIN = requireRole('ADMIN');
const ANY = requireRole('ADMIN', 'DISPATCHER');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

router.get('/health', systemC.health);

// Authentication
router.post('/auth/login', loginLimiter, authC.login);
router.post('/auth/logout', authenticate, authC.logout);
router.get('/auth/me', authenticate, authC.me);
router.post('/auth/password', authenticate, authC.changePassword);

// Everything below needs a valid session.
router.use(authenticate);

// Live state, simulation and demo
router.get('/live', systemC.live);
router.put('/sim', ANY, systemC.setOptions);
router.post('/sim/demo', ANY, systemC.startDemo);
router.delete('/sim/demo', ANY, systemC.stopDemo);
router.post('/sim/reset', ADMIN, systemC.reset);

// Emergencies
router.get('/emergencies', emergencyC.list);
router.get('/emergencies/:id', emergencyC.get);
router.post('/emergencies', ANY, emergencyC.create);
router.put('/emergencies/:id', ANY, emergencyC.update);
router.delete('/emergencies/:id', ANY, emergencyC.remove);

// Ambulances
router.get('/ambulances', fleetC.listAmbulances);
router.get('/ambulances/:id', fleetC.getAmbulance);
router.post('/ambulances', ADMIN, fleetC.createAmbulance);
router.put('/ambulances/:id', ADMIN, fleetC.updateAmbulance);
router.post('/ambulances/:id/return', ANY, fleetC.returnAmbulance);

// Hospitals
router.get('/hospitals', fleetC.listHospitals);
router.post('/hospitals', ADMIN, fleetC.createHospital);
router.put('/hospitals/:id', ADMIN, fleetC.updateHospital);

// Dispatch
router.post('/dispatch/next', ANY, dispatchC.dispatchNext);
router.get('/dispatch/:emergencyId/recommendation', ANY, dispatchC.recommendation);
router.post('/dispatch/:emergencyId', ANY, dispatchC.dispatch);

// Routes and algorithms
router.post('/routes/calculate', networkC.calculateRoute);
router.post('/routes/bfs', networkC.reachability);
router.post('/routes/compare', networkC.compareRoutes);

// Traffic
router.get('/traffic', networkC.getTraffic);
router.get('/traffic/export.csv', ADMIN, networkC.exportTraffic);
router.get('/traffic/presets', networkC.listPresets);
router.post('/traffic/preset', ADMIN, networkC.applyPreset);
router.put('/roads/:roadId/traffic', ADMIN, networkC.setTraffic);
router.put('/roads/:roadId/close', ADMIN, networkC.closeRoad);
router.put('/roads/:roadId/reopen', ADMIN, networkC.reopenRoad);

// Missions
router.get('/missions', ADMIN, dispatchC.listMissions);
router.get('/missions/export.csv', ADMIN, networkC.exportMissions);
router.get('/missions/:id', dispatchC.getMission);
router.get('/missions/:id/hospital-options', ANY, dispatchC.hospitalOptions);
router.post('/missions/:id/pickup', ANY, dispatchC.pickup);
router.post('/missions/:id/complete', ANY, dispatchC.complete);

// Analytics and graph
router.get('/analytics', ADMIN, networkC.analytics);
router.get('/graph', networkC.getGraph);
router.post('/graph/nodes', ADMIN, networkC.addNode);
router.post('/graph/roads', ADMIN, networkC.addRoad);

// Public helplines and hospital numbers
router.get('/resources', resourceC.list);
router.post('/resources', ADMIN, resourceC.create);
router.put('/resources/:id', ADMIN, resourceC.update);
router.delete('/resources/:id', ADMIN, resourceC.remove);

// Data structures page
router.get('/datastructures', networkC.dataStructures);
router.get('/datastructures/hash', networkC.inspectHash);
router.post('/datastructures/hash-demo', networkC.hashDemo);

module.exports = router;
