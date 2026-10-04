import { useMemo } from 'react';

// Must match BOUNDS in database/seed.js so tiles line up with node positions.
export const BOUNDS = { lonMin: 80.005, lonMax: 80.402, latTop: 13.13, latBottom: 12.89 };
export const MAP_W = 1000;
export const MAP_H = 620;
const ZOOM = 12;

const tileX = (lon) => ((lon + 180) / 360) * 2 ** ZOOM;
const tileY = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** ZOOM;
};

/** OpenStreetMap tiles covering the map bounds, positioned in map units. */
export function tileList() {
  const x0 = tileX(BOUNDS.lonMin);
  const x1 = tileX(BOUNDS.lonMax);
  const y0 = tileY(BOUNDS.latTop);
  const y1 = tileY(BOUNDS.latBottom);
  const w = MAP_W / (x1 - x0);
  const h = MAP_H / (y1 - y0);
  const out = [];
  for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx += 1) {
    for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty += 1) {
      out.push({
        key: `${tx}-${ty}`,
        href: `https://a.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${tx}/${ty}.png`,
        x: (tx - x0) * w,
        y: (ty - y0) * h,
        width: w + 0.5,
        height: h + 0.5,
      });
    }
  }
  return out;
}

export function useTiles() {
  return useMemo(tileList, []);
}

/** Inverse of the seed projection: map units to latitude and longitude. */
export function toLatLon(x, y) {
  const lon = BOUNDS.lonMin + (x / MAP_W) * (BOUNDS.lonMax - BOUNDS.lonMin);
  const m = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const top = m(BOUNDS.latTop);
  const bottom = m(BOUNDS.latBottom);
  const merc = top - (y / MAP_H) * (top - bottom);
  const lat = ((2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180) / Math.PI;
  return { lat, lon };
}
