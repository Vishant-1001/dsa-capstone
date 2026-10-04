/**
 * Demo data for the simulated Chennai road network.
 *
 * Place names and coordinates are real Chennai localities and hospitals. The road links, travel
 * times, ambulance stations, bed counts and specialties are simulated.
 *
 * Usage:  node database/seed.js            seed only if the database is empty
 *         node database/seed.js --reset    wipe the city and operational data, then seed again
 */
const { hashPassword } = require('../server/utils/passwords');

const SEED_VERSION = '4';

// The map canvas is 1000 by 620. These bounds match the tile layer drawn by the client.
const BOUNDS = { lonMin: 80.005, lonMax: 80.402, latTop: 13.13, latBottom: 12.89 };
const W = 1000;
const H = 620;
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

function project(lat, lon) {
  const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * W;
  const y = ((mercator(BOUNDS.latTop) - mercator(lat)) / (mercator(BOUNDS.latTop) - mercator(BOUNDS.latBottom))) * H;
  return [Math.round(x), Math.round(y)];
}

// id, name, type, latitude, longitude
const PLACES = [
  ['N01', 'Avadi', 'JUNCTION', 13.1147, 80.1098],
  ['N02', 'Ambattur', 'JUNCTION', 13.1143, 80.1548],
  ['N03', 'Anna Nagar', 'BUILDING', 13.085, 80.2101],
  ['N04', 'Perambur', 'JUNCTION', 13.1186, 80.233],
  ['N05', 'Royapuram', 'BUILDING', 13.1133, 80.295],
  ['N06', 'Porur', 'BUILDING', 13.0382, 80.1565],
  ['N07', 'Koyambedu', 'JUNCTION', 13.0694, 80.1948],
  ['N08', 'Kilpauk', 'BUILDING', 13.0836, 80.2411],
  ['N09', 'Chetpet', 'JUNCTION', 13.0733, 80.2411],
  ['N10', 'Chepauk', 'BUILDING', 13.0627, 80.2793],
  ['N11', 'Marina Beach', 'JUNCTION', 13.05, 80.2824],
  ['N12', 'Alandur', 'JUNCTION', 13.003, 80.2006],
  ['N13', 'Guindy', 'BUILDING', 13.0067, 80.2206],
  ['N14', 'Saidapet', 'JUNCTION', 13.0213, 80.2231],
  ['N15', 'T. Nagar', 'BUILDING', 13.0418, 80.2341],
  ['N16', 'Mylapore', 'JUNCTION', 13.0368, 80.2676],
  ['N17', 'Besant Nagar', 'BUILDING', 13.0002, 80.2667],
  ['N18', 'Chromepet', 'JUNCTION', 12.9516, 80.1462],
  ['N19', 'Pallavaram', 'JUNCTION', 12.9675, 80.1491],
  ['N20', 'Medavakkam', 'BUILDING', 12.92, 80.1925],
  ['N21', 'Velachery', 'JUNCTION', 12.9815, 80.218],
  ['N22', 'Sholinganallur', 'JUNCTION', 12.901, 80.2279],
  ['ST1', 'Teynampet Ambulance Station', 'STATION', 13.0418, 80.25],
  ['ST2', 'Purasawalkam Ambulance Station', 'STATION', 13.0827, 80.2517],
  ['ST3', 'Thiruvanmiyur Ambulance Station', 'STATION', 12.983, 80.2594],
  ['HN1', 'Rajiv Gandhi Government General Hospital', 'HOSPITAL', 13.081, 80.2756],
  ['HN2', 'Apollo Hospitals, Greams Road', 'HOSPITAL', 13.0604, 80.252],
  ['HN3', 'MIOT International', 'HOSPITAL', 13.0189, 80.1844],
  ['HN4', 'Institute of Child Health and Hospital for Children', 'HOSPITAL', 13.076, 80.261],
  ['HN5', 'Fortis Malar Hospital, Adyar', 'HOSPITAL', 13.0069, 80.2565],
];

const COORDS = {};
const NODES = PLACES.map(([id, name, type, lat, lon]) => {
  COORDS[id] = [lat, lon];
  const [x, y] = project(lat, lon);
  return [id, name, type, x, y];
});

const ROADS = [
  ['N01', 'N02'], ['N02', 'N03'], ['N02', 'N04'], ['N03', 'N04'], ['N04', 'N05'],
  ['N04', 'N08'], ['N03', 'N08'], ['N03', 'N07'], ['N01', 'N06'], ['N06', 'N07'],
  ['N06', 'N12'], ['N07', 'N15'], ['N08', 'N09'], ['N09', 'N15'], ['N09', 'N10'],
  ['N10', 'N11'], ['N11', 'N16'], ['N15', 'N16'], ['N15', 'N14'], ['N14', 'N13'],
  ['N13', 'N12'], ['N16', 'N17'], ['N13', 'N21'], ['N21', 'N17'], ['N21', 'N20'],
  ['N21', 'N22'], ['N20', 'N22'], ['N12', 'N19'], ['N19', 'N18'], ['N18', 'N20'],
  ['ST1', 'N15'], ['ST1', 'N16'], ['ST1', 'HN2'],
  ['ST2', 'N08'], ['ST2', 'N09'], ['ST2', 'HN4'],
  ['ST3', 'N17'], ['ST3', 'N21'], ['ST3', 'HN5'],
  ['HN1', 'N05'], ['HN1', 'N10'], ['HN1', 'N09'],
  ['HN2', 'N15'], ['HN2', 'N09'],
  ['HN3', 'N12'], ['HN3', 'N14'], ['HN3', 'N06'],
  ['HN4', 'N09'],
  ['HN5', 'N17'], ['HN5', 'N16'],
];

// id, home station, equipment
const AMBULANCES = [
  ['A1', 'ST1', 'BASIC'],
  ['A2', 'ST1', 'ALS'],
  ['A3', 'ST2', 'TRAUMA'],
  ['A4', 'ST2', 'BASIC'],
  ['A5', 'ST2', 'ALS'],
  ['A6', 'ST1', 'PEDIATRIC'],
  ['A7', 'ST3', 'TRAUMA'],
  ['A8', 'ST3', 'BASIC'],
];

// id, node, total beds, available beds, specialties. Beds and specialties are simulated.
const HOSPITALS = [
  ['H1', 'HN1', 40, 14, ['GENERAL', 'CARDIAC', 'TRAUMA', 'NEUROLOGY', 'RESPIRATORY', 'BURN']],
  ['H2', 'HN2', 20, 6, ['GENERAL', 'CARDIAC', 'NEUROLOGY']],
  ['H3', 'HN3', 30, 9, ['GENERAL', 'TRAUMA', 'NEUROLOGY']],
  ['H4', 'HN4', 24, 8, ['GENERAL', 'PEDIATRIC', 'RESPIRATORY']],
  ['H5', 'HN5', 25, 11, ['GENERAL', 'CARDIAC', 'RESPIRATORY']],
];

const VERIFY = 'Check this number against the hospital\'s official website before relying on it.';

// kind, name, phone, alt phone, hospital id, address, notes
const CONTACTS = [
  ['HELPLINE', 'National emergency number', '112', null, null, null, 'Single emergency number for police, fire and ambulance across India.'],
  ['HELPLINE', 'Emergency ambulance, Tamil Nadu', '108', null, null, null, 'Free 24 hour emergency ambulance service.'],
  ['HELPLINE', 'Ambulance for mothers and infants, Tamil Nadu', '102', null, null, null, 'Free ambulance service for pregnant women and infants.'],
  ['HELPLINE', 'Tamil Nadu health helpline', '104', null, null, null, 'Health information and counselling.'],
  ['HELPLINE', 'Greater Chennai Corporation helpline', '1913', null, null, null, 'Civic complaints and information.'],
  ['HOSPITAL', 'Rajiv Gandhi Government General Hospital', null, null, 'H1', 'Park Town, Chennai 600003', `Government tertiary hospital. Number not added yet. ${VERIFY}`],
  ['HOSPITAL', 'Apollo Hospitals, Greams Road', '1860-500-1066', '1066', 'H2', '21 Greams Lane, Greams Road, Chennai 600006', 'Health help line and emergency number published in the footer of the Apollo Hospitals website. A Greams Road front desk number is not added yet.', 'apollohospitals.com footer, October 2026'],
  ['HOSPITAL', 'MIOT International', null, null, 'H3', 'Mount Poonamallee Road, Manapakkam, Chennai 600089', `Number not added yet. ${VERIFY}`],
  ['HOSPITAL', 'Institute of Child Health and Hospital for Children', null, null, 'H4', 'Halls Road, Egmore, Chennai 600008', `Number not added yet. ${VERIFY}`],
  ['HOSPITAL', 'Fortis Malar Hospital, Adyar', null, null, 'H5', 'Gandhi Nagar, Adyar, Chennai 600020', `Number not added yet. ${VERIFY}`],
];

const USERS = [
  ['admin', 'Control Room Admin', 'Admin@123', 'ADMIN'],
  ['dispatcher', 'Shift Dispatcher', 'Dispatch@123', 'DISPATCHER'],
];

const DEFAULT_SETTINGS = {
  sim_clock: '0',
  sim_speed: '2',
  sim_paused: '0',
  auto_dispatch: '0',
  auto_return: '0',
  emergency_seq: '0',
  mission_seq: '0',
  arrival_seq: '0',
  seed_version: SEED_VERSION,
};

const round1 = (n) => Math.round(n * 10) / 10;
const now = () => new Date().toISOString();

function haversineKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Distance is great-circle length times 1.3 for winding roads. Longer links are assumed faster. */
function buildRoads() {
  return ROADS.map(([a, b], i) => {
    const distance = Math.max(0.4, round1(haversineKm(COORDS[a], COORDS[b]) * 1.3));
    const access = /^(ST|HN)/.test(a) || /^(ST|HN)/.test(b);
    const speed = access ? 30 : distance > 6 ? 45 : 35;
    const time = Math.max(0.5, round1((distance / speed) * 60));
    return { id: `R${String(i + 1).padStart(2, '0')}`, source: a, destination: b, distance, time };
  });
}

function seedCity(db) {
  const ts = now();
  const insertNode = db.prepare('INSERT INTO nodes (id, name, type, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertRoad = db.prepare(`INSERT INTO roads (id, source, destination, distance, normal_travel_time, current_travel_time,
    traffic_level, is_closed, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'LOW', 0, ?)`);
  const insertAmb = db.prepare(`INSERT INTO ambulances (id, name, node_id, home_station_id, status, equipment, distance_travelled,
    created_at, updated_at) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, 0, ?, ?)`);
  const insertHosp = db.prepare(`INSERT INTO hospitals (id, name, node_id, total_beds, available_beds, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`);
  const insertSpec = db.prepare('INSERT INTO hospital_specialties (hospital_id, specialty) VALUES (?, ?)');
  const insertContact = db.prepare(`INSERT INTO contacts (kind, name, phone, alt_phone, hospital_id, address, notes, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const nameOf = {};
  NODES.forEach((n) => { nameOf[n[0]] = n[1]; });

  const run = db.transaction(() => {
    NODES.forEach(([id, name, type, x, y]) => insertNode.run(id, name, type, x, y, ts));
    buildRoads().forEach((r) => insertRoad.run(r.id, r.source, r.destination, r.distance, r.time, r.time, ts));
    AMBULANCES.forEach(([id, home, eq]) => insertAmb.run(id, `Unit ${id}`, home, home, eq, ts, ts));
    HOSPITALS.forEach(([id, node, total, avail, specs]) => {
      insertHosp.run(id, nameOf[node], node, total, avail, ts, ts);
      specs.forEach((s) => insertSpec.run(id, s));
    });
    CONTACTS.forEach(([kind, name, phone, alt, hospitalId, address, notes, source]) => {
      insertContact.run(kind, name, phone, alt, hospitalId, address, notes, source || 'Seed data', ts);
    });
    Object.keys(DEFAULT_SETTINGS).forEach((k) => upsertSetting.run(k, DEFAULT_SETTINGS[k]));
  });
  run();
}

function seedUsers(db) {
  const insert = db.prepare('INSERT INTO users (username, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)');
  USERS.forEach(([username, fullName, password, role]) => insert.run(username, fullName, hashPassword(password), role, now()));
}

/** Removes the city and all operational data, keeping user accounts and secrets. */
function clearCity(db) {
  const run = db.transaction(() => {
    ['missions', 'emergencies', 'traffic_events', 'contacts', 'hospital_specialties', 'hospitals', 'ambulances', 'roads', 'nodes'].forEach((t) => {
      db.prepare(`DELETE FROM ${t}`).run();
    });
    db.prepare('DELETE FROM settings WHERE key IN (' + Object.keys(DEFAULT_SETTINGS).map(() => '?').join(',') + ')')
      .run(...Object.keys(DEFAULT_SETTINGS));
  });
  run();
}

function resetCity(db) {
  clearCity(db);
  seedCity(db);
}

/** Seeds users and the city when empty, and replaces an older seed layout once. */
function ensureSeeded(db) {
  const done = { users: false, city: false };
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) {
    seedUsers(db);
    done.users = true;
  }
  const nodes = db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c;
  const row = db.prepare("SELECT value FROM settings WHERE key = 'seed_version'").get();
  if (nodes === 0) {
    seedCity(db);
    done.city = true;
  } else if (!row || row.value !== SEED_VERSION) {
    resetCity(db);
    done.city = true;
  }
  return done;
}

module.exports = { NODES, ROADS, AMBULANCES, HOSPITALS, USERS, BOUNDS, DEFAULT_SETTINGS, buildRoads, project, seedCity, seedUsers, ensureSeeded, resetCity };

if (require.main === module) {
  const db = require('../server/db');
  if (process.argv.includes('--reset')) {
    resetCity(db);
    ensureSeeded(db);
    console.log('City and operational data reset to the demo seed.');
  } else {
    const done = ensureSeeded(db);
    console.log(done.city || done.users ? 'Database seeded.' : 'Database already contains data. Use --reset to start over.');
  }
  const counts = {
    nodes: db.prepare('SELECT COUNT(*) c FROM nodes').get().c,
    roads: db.prepare('SELECT COUNT(*) c FROM roads').get().c,
    ambulances: db.prepare('SELECT COUNT(*) c FROM ambulances').get().c,
    hospitals: db.prepare('SELECT COUNT(*) c FROM hospitals').get().c,
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  };
  console.log(counts);
}
