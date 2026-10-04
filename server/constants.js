const TRAFFIC_MULTIPLIER = Object.freeze({ LOW: 1.0, MODERATE: 1.4, HIGH: 2.0, SEVERE: 3.0 });
const TRAFFIC_LEVELS = Object.freeze(Object.keys(TRAFFIC_MULTIPLIER));

const SEVERITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const EMERGENCY_TYPES = Object.freeze(['CARDIAC', 'ACCIDENT', 'TRAUMA', 'RESPIRATORY', 'FIRE_INJURY', 'GENERAL', 'OTHER']);
const EQUIPMENT = Object.freeze(['BASIC', 'ALS', 'TRAUMA', 'PEDIATRIC']);
const SPECIALTIES = Object.freeze(['GENERAL', 'CARDIAC', 'TRAUMA', 'PEDIATRIC', 'RESPIRATORY', 'BURN', 'NEUROLOGY']);

const AMBULANCE_STATUSES = Object.freeze(['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'RETURNING', 'OFFLINE']);
const EMERGENCY_STATUSES = Object.freeze(['PENDING', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED', 'CANCELLED']);
const ACTIVE_EMERGENCY_STATUSES = Object.freeze(['PENDING', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING']);
const MISSION_STATUSES = Object.freeze(['DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'COMPLETED', 'CANCELLED']);
const ACTIVE_MISSION_STATUSES = Object.freeze(['DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING']);
const NODE_TYPES = Object.freeze(['JUNCTION', 'BUILDING', 'STATION', 'HOSPITAL']);
const ROLES = Object.freeze(['ADMIN', 'DISPATCHER']);

/** Sensible defaults for the report form, mirrored on the client. */
const TYPE_DEFAULTS = Object.freeze({
  CARDIAC: { equipment: 'ALS', specialty: 'CARDIAC' },
  ACCIDENT: { equipment: 'TRAUMA', specialty: 'TRAUMA' },
  TRAUMA: { equipment: 'TRAUMA', specialty: 'TRAUMA' },
  RESPIRATORY: { equipment: 'ALS', specialty: 'RESPIRATORY' },
  FIRE_INJURY: { equipment: 'TRAUMA', specialty: 'BURN' },
  GENERAL: { equipment: 'BASIC', specialty: 'GENERAL' },
  OTHER: { equipment: 'BASIC', specialty: 'GENERAL' },
});

/** Simulation minutes that pass per real second at 1x speed. */
const SIM_MINUTES_PER_SECOND = 1;
/** Crew turnout time before an ambulance leaves, in simulation minutes. */
const TURNOUT_MINUTES = 1;

module.exports = {
  TRAFFIC_MULTIPLIER,
  TRAFFIC_LEVELS,
  SEVERITIES,
  EMERGENCY_TYPES,
  EQUIPMENT,
  SPECIALTIES,
  AMBULANCE_STATUSES,
  EMERGENCY_STATUSES,
  ACTIVE_EMERGENCY_STATUSES,
  MISSION_STATUSES,
  ACTIVE_MISSION_STATUSES,
  NODE_TYPES,
  ROLES,
  TYPE_DEFAULTS,
  SIM_MINUTES_PER_SECOND,
  TURNOUT_MINUTES,
};
