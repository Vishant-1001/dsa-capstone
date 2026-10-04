export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const SEVERITY_COLOR = { CRITICAL: '#e5484d', HIGH: '#f0883e', MEDIUM: '#d6b13a', LOW: '#5aa88a' };
export const SEVERITY_PRIORITY = { CRITICAL: 10, HIGH: 7, MEDIUM: 5, LOW: 2 };

export const EMERGENCY_TYPES = ['CARDIAC', 'ACCIDENT', 'TRAUMA', 'RESPIRATORY', 'FIRE_INJURY', 'GENERAL', 'OTHER'];
export const EQUIPMENT = ['BASIC', 'ALS', 'TRAUMA', 'PEDIATRIC'];
export const SPECIALTIES = ['GENERAL', 'CARDIAC', 'TRAUMA', 'PEDIATRIC', 'RESPIRATORY', 'BURN', 'NEUROLOGY'];

export const TYPE_DEFAULTS = {
  CARDIAC: { equipment: 'ALS', specialty: 'CARDIAC' },
  ACCIDENT: { equipment: 'TRAUMA', specialty: 'TRAUMA' },
  TRAUMA: { equipment: 'TRAUMA', specialty: 'TRAUMA' },
  RESPIRATORY: { equipment: 'ALS', specialty: 'RESPIRATORY' },
  FIRE_INJURY: { equipment: 'TRAUMA', specialty: 'BURN' },
  GENERAL: { equipment: 'BASIC', specialty: 'GENERAL' },
  OTHER: { equipment: 'BASIC', specialty: 'GENERAL' },
};

export const AMBULANCE_STATUS_COLOR = {
  AVAILABLE: '#3fb68b',
  DISPATCHED: '#e0a93a',
  EN_ROUTE: '#f0883e',
  AT_SCENE: '#e5484d',
  TRANSPORTING: '#4aa3df',
  RETURNING: '#8593a3',
  OFFLINE: '#4a5663',
};

export const STATUS_COLOR = {
  ...AMBULANCE_STATUS_COLOR,
  PENDING: '#d6b13a',
  COMPLETED: '#3fb68b',
  CANCELLED: '#5d6b7b',
  OPEN: '#3fb68b',
  CLOSED: '#e5484d',
};

export const TRAFFIC_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
export const TRAFFIC_COLOR = { LOW: '#4a6078', MODERATE: '#d6b13a', HIGH: '#f0883e', SEVERE: '#e5484d' };
export const TRAFFIC_LABEL = { LOW: 'Normal', MODERATE: 'Moderate', HIGH: 'Heavy', SEVERE: 'Severe' };
export const TRAFFIC_MULTIPLIER = { LOW: 1.0, MODERATE: 1.4, HIGH: 2.0, SEVERE: 3.0 };

export const NODE_TYPES = ['JUNCTION', 'BUILDING', 'STATION', 'HOSPITAL'];

/** Sidebar entries. `roles` limits who sees the item. */
export const NAV = [
  { group: 'Operations', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { to: '/map', label: 'Live Map', icon: 'Map' },
    { to: '/emergencies', label: 'Emergencies', icon: 'Siren' },
    { to: '/dispatch', label: 'Dispatch Center', icon: 'RadioTower' },
  ] },
  { group: 'Resources', items: [
    { to: '/ambulances', label: 'Ambulances', icon: 'Truck' },
    { to: '/hospitals', label: 'Hospitals', icon: 'Building2' },
    { to: '/resources', label: 'Resources', icon: 'Phone' },
  ] },
  { group: 'Network', items: [
    { to: '/traffic', label: 'Traffic Control', icon: 'Construction', roles: ['ADMIN'] },
  ] },
  { group: 'Records', items: [
    { to: '/history', label: 'Mission History', icon: 'History', roles: ['ADMIN'] },
    { to: '/analytics', label: 'Analytics', icon: 'BarChart3', roles: ['ADMIN'] },
  ] },
  { group: 'Learn', items: [
    { to: '/data-structures', label: 'Data Structures', icon: 'Network' },
  ] },
  { group: 'System', items: [
    { to: '/settings', label: 'Settings', icon: 'Settings' },
  ] },
];
