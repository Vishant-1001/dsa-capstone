PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('ADMIN', 'DISPATCHER')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- Graph vertices
CREATE TABLE IF NOT EXISTS nodes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('JUNCTION', 'BUILDING', 'STATION', 'HOSPITAL')),
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  created_at TEXT NOT NULL
);

-- Graph edges (two-way roads)
CREATE TABLE IF NOT EXISTS roads (
  id                  TEXT PRIMARY KEY,
  source              TEXT NOT NULL REFERENCES nodes(id),
  destination         TEXT NOT NULL REFERENCES nodes(id),
  distance            REAL NOT NULL CHECK (distance > 0),
  normal_travel_time  REAL NOT NULL CHECK (normal_travel_time > 0),
  current_travel_time REAL NOT NULL CHECK (current_travel_time > 0),
  traffic_level       TEXT NOT NULL DEFAULT 'LOW' CHECK (traffic_level IN ('LOW', 'MODERATE', 'HIGH', 'SEVERE')),
  is_closed           INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL,
  CHECK (source <> destination)
);

CREATE TABLE IF NOT EXISTS ambulances (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  node_id            TEXT NOT NULL REFERENCES nodes(id),
  home_station_id    TEXT REFERENCES nodes(id),
  status             TEXT NOT NULL DEFAULT 'AVAILABLE'
                     CHECK (status IN ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'RETURNING', 'OFFLINE')),
  equipment          TEXT NOT NULL CHECK (equipment IN ('BASIC', 'ALS', 'TRAUMA', 'PEDIATRIC')),
  current_mission_id TEXT,
  distance_travelled REAL NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  node_id        TEXT NOT NULL UNIQUE REFERENCES nodes(id),
  total_beds     INTEGER NOT NULL CHECK (total_beds >= 0),
  available_beds INTEGER NOT NULL CHECK (available_beds >= 0),
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  CHECK (available_beds <= total_beds)
);

CREATE TABLE IF NOT EXISTS hospital_specialties (
  hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  specialty   TEXT NOT NULL CHECK (specialty IN ('GENERAL', 'CARDIAC', 'TRAUMA', 'PEDIATRIC', 'RESPIRATORY', 'BURN', 'NEUROLOGY')),
  PRIMARY KEY (hospital_id, specialty)
);

CREATE TABLE IF NOT EXISTS emergencies (
  id                    TEXT PRIMARY KEY,
  type                  TEXT NOT NULL CHECK (type IN ('CARDIAC', 'ACCIDENT', 'TRAUMA', 'RESPIRATORY', 'FIRE_INJURY', 'GENERAL', 'OTHER')),
  severity              TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  priority              INTEGER NOT NULL,
  node_id               TEXT NOT NULL REFERENCES nodes(id),
  required_equipment    TEXT NOT NULL CHECK (required_equipment IN ('BASIC', 'ALS', 'TRAUMA', 'PEDIATRIC')),
  required_specialty    TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED', 'CANCELLED')),
  arrival_seq           INTEGER NOT NULL,
  created_sim           REAL NOT NULL DEFAULT 0,
  assigned_ambulance_id TEXT,
  mission_id            TEXT,
  reported_by           TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  completed_at          TEXT
);

CREATE TABLE IF NOT EXISTS missions (
  id                    TEXT PRIMARY KEY,
  emergency_id          TEXT NOT NULL REFERENCES emergencies(id),
  ambulance_id          TEXT NOT NULL REFERENCES ambulances(id),
  hospital_id           TEXT REFERENCES hospitals(id),
  severity              TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED', 'CANCELLED')),
  leg                   TEXT NOT NULL DEFAULT 'SCENE' CHECK (leg IN ('SCENE', 'HOSPITAL')),
  active_route          TEXT,
  seg_index             INTEGER NOT NULL DEFAULT 0,
  seg_frac              REAL NOT NULL DEFAULT 0,
  hold_remaining        REAL NOT NULL DEFAULT 0,
  leg_elapsed           REAL NOT NULL DEFAULT 0,
  blocked               INTEGER NOT NULL DEFAULT 0,
  scene_route           TEXT,
  hospital_route        TEXT,
  selection_log         TEXT,
  hospital_log          TEXT,
  reroutes              TEXT NOT NULL DEFAULT '[]',
  reroute_count         INTEGER NOT NULL DEFAULT 0,
  scene_distance        REAL NOT NULL DEFAULT 0,
  scene_planned_time    REAL NOT NULL DEFAULT 0,
  scene_actual_time     REAL,
  hospital_distance     REAL NOT NULL DEFAULT 0,
  hospital_planned_time REAL NOT NULL DEFAULT 0,
  hospital_actual_time  REAL,
  response_time         REAL,
  travel_time           REAL,
  total_distance        REAL,
  traffic_delay         REAL NOT NULL DEFAULT 0,
  dispatch_sim          REAL NOT NULL DEFAULT 0,
  dispatched_by         TEXT,
  dispatched_at         TEXT NOT NULL,
  arrived_scene_at      TEXT,
  pickup_at             TEXT,
  completed_at          TEXT
);

CREATE TABLE IF NOT EXISTS traffic_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('TRAFFIC_CHANGE', 'ROAD_CLOSED', 'ROAD_REOPENED', 'REROUTE', 'UNREACHABLE')),
  road_id    TEXT,
  old_level  TEXT,
  new_level  TEXT,
  mission_id TEXT,
  eta_before REAL,
  eta_after  REAL,
  details    TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- Public helplines and hospital contact numbers kept as a resource directory
CREATE TABLE IF NOT EXISTS contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL CHECK (kind IN ('HELPLINE', 'HOSPITAL')),
  name        TEXT NOT NULL,
  phone       TEXT,
  alt_phone   TEXT,
  hospital_id TEXT REFERENCES hospitals(id) ON DELETE SET NULL,
  address     TEXT,
  website     TEXT,
  notes       TEXT,
  source      TEXT,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roads_source ON roads(source);
CREATE INDEX IF NOT EXISTS idx_roads_destination ON roads(destination);
CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies(status);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_emergency ON missions(emergency_id);
CREATE INDEX IF NOT EXISTS idx_missions_ambulance ON missions(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_traffic_events_road ON traffic_events(road_id);
