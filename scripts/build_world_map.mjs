// Builds images/world-map.json for the McDonald's tracker page.
//
//   npm install world-atlas topojson-client d3-geo world-countries
//   node build_world_map.mjs > world-map.json
//
// Output: {
//   viewBox: "0 0 960 H",
//   paths:    { "IN": "M...Z", ... },  projected country outlines (mainland), keyed by ISO 3166-1 alpha-2
//   overseas: { "FR": "M...Z", ... },  far-flung pieces (French Guiana, ...): drawn as plain land, never shaded
//   points:   { "IN": [x, y], ... }    projected centre of every ISO code (also used to validate codes)
// }
// Mainland vs overseas: for countries made of several pieces, the largest piece (and any piece at least
// 40% as big) is the mainland, and any piece linked to it by gaps under LINK_KM (islands, exclaves) is
// kept with it. Everything else (French Guiana, the Canaries, Svalbard...) goes into "overseas" so the
// land stays on the map but is not shaded with the country. FULL_COUNTRIES are never split: the United
// States keeps Alaska and Hawaii in its shading.
// Data: Natural Earth via world-atlas (public domain), centres from world-countries (ODbL).
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoEqualEarth, geoPath, geoArea, geoDistance } from 'd3-geo';
import { createRequire } from 'node:module';
const countries = createRequire(import.meta.url)('world-countries');

const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-110m.json', 'utf8'));
const W = 960;
const EARTH_KM = 6371;
const LINK_KM = 500;
const BIG_SHARE = 0.4; // a piece at least this big (vs. the largest) is also mainland, e.g. Malaysia's two halves

const FULL_COUNTRIES = new Set(['840']); // United States

/** Split a country into { main, rest }: the largest polygon plus everything chained to it by gaps under LINK_KM. */
function split(f, log) {
  const geom = f.geometry;
  if (FULL_COUNTRIES.has(String(f.id)) || !geom || geom.type !== 'MultiPolygon' || geom.coordinates.length < 2) {
    return { main: f, rest: null };
  }
  const polys = geom.coordinates;
  const rings = polys.map((p) => p[0]);
  const areas = polys.map((p) => geoArea({ type: 'Polygon', coordinates: p }));
  const gapKm = (a, b) => {
    let m = Infinity;
    for (const p of a) for (const q of b) m = Math.min(m, geoDistance(p, q));
    return m * EARTH_KM;
  };
  const biggest = Math.max(...areas);
  const keep = new Set();
  areas.forEach((a, i) => { if (a >= BIG_SHARE * biggest) keep.add(i); });
  const queue = [...keep];
  while (queue.length) {
    const i = queue.pop();
    for (let j = 0; j < polys.length; j++) {
      if (!keep.has(j) && gapKm(rings[i], rings[j]) < LINK_KM) { keep.add(j); queue.push(j); }
    }
  }
  if (keep.size === polys.length) return { main: f, rest: null };
  polys.forEach((p, i) => {
    if (!keep.has(i)) log.push(`${f.id} ${f.properties?.name ?? ''}: overseas piece near ${rings[i][0].map((v) => v.toFixed(1))}`);
  });
  const piece = (pred) => ({ ...f, geometry: { type: 'MultiPolygon', coordinates: polys.filter((_, i) => pred(i)) } });
  return { main: piece((i) => keep.has(i)), rest: piece((i) => !keep.has(i)) };
}
const all = feature(topo, topo.objects.countries).features;
const land = all.filter((f) => f.id !== '010'); // drop Antarctica
const log = [];

const projection = geoEqualEarth();
projection.fitWidth(W, { type: 'FeatureCollection', features: land });
const path = geoPath(projection).digits(1);
const [[, y0], [, y1]] = path.bounds({ type: 'FeatureCollection', features: land });
const H = Math.ceil(y1 + 1);

const byNumeric = new Map(countries.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca2]));

const paths = {};
const overseas = {};
for (const f of land) {
  const code = byNumeric.get(String(f.id).padStart(3, '0'));
  if (!code) continue; // a few disputed areas have no ISO code
  const { main, rest } = split(f, log);
  const d = path(main);
  if (!d) continue;
  paths[code] = d;
  const dr = rest && path(rest);
  if (dr) overseas[code] = dr;
}
log.forEach((l) => console.error(l));

const points = {};
for (const c of countries) {
  if (!c.latlng || c.latlng.length < 2) continue;
  const p = projection([c.latlng[1], c.latlng[0]]);
  if (p) points[c.cca2] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}

console.log(JSON.stringify({ viewBox: `0 0 ${W} ${H}`, paths, overseas, points }));
