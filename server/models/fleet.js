const { db, stmt, makeModel } = require('./factory');

const ambulances = makeModel({
  table: 'ambulances',
  columns: {
    id: 'id',
    name: 'name',
    nodeId: 'node_id',
    homeStationId: 'home_station_id',
    status: 'status',
    equipment: 'equipment',
    currentMissionId: 'current_mission_id',
    distanceTravelled: 'distance_travelled',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

const hospitalBase = makeModel({
  table: 'hospitals',
  columns: {
    id: 'id',
    name: 'name',
    nodeId: 'node_id',
    totalBeds: 'total_beds',
    availableBeds: 'available_beds',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

function specialtiesFor(id) {
  return stmt('SELECT specialty FROM hospital_specialties WHERE hospital_id = ? ORDER BY specialty').all(id).map((r) => r.specialty);
}

const hospitals = {
  ...hospitalBase,
  all() {
    const list = hospitalBase.all('id');
    const rows = stmt('SELECT hospital_id, specialty FROM hospital_specialties ORDER BY specialty').all();
    return list.map((h) => ({ ...h, specialties: rows.filter((r) => r.hospital_id === h.id).map((r) => r.specialty) }));
  },
  get(id) {
    const h = hospitalBase.get(id);
    return h ? { ...h, specialties: specialtiesFor(id) } : null;
  },
  setSpecialties(id, list) {
    const run = db.transaction(() => {
      stmt('DELETE FROM hospital_specialties WHERE hospital_id = ?').run(id);
      list.forEach((s) => stmt('INSERT INTO hospital_specialties (hospital_id, specialty) VALUES (?, ?)').run(id, s));
    });
    run();
  },
};

module.exports = { ambulances, hospitals };
