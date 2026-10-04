/** FIRE_INJURY -> Fire injury */
export function label(value) {
  if (!value) return '';
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtMin(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  return `${Number(value).toFixed(1)} min`;
}

export function fmtKm(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  return `${Number(value).toFixed(1)} km`;
}

export function fmtTime(iso) {
  if (!iso) return 'n/a';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return 'n/a';
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/** Turns node ids into a readable route: "ST1 > N08 > HN2". */
export function pathString(path) {
  if (!path || path.length === 0) return 'No route';
  return path.join(' \u2192 ');
}

export function pathNames(path, nodeById) {
  if (!path) return [];
  return path.map((id) => (nodeById && nodeById[id] ? nodeById[id].name : id));
}

export function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}
