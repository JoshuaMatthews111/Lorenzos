// ZIP -> ZIP distance for the booking page (portal chain step 3c, DO-NOT-BREAK rule 74).
//
// lib/zip-centroids.json is the U.S. Census Bureau 2024 Gazetteer "ZIP Code Tabulation Areas"
// national file (https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/
// 2024_Gaz_zcta_national.zip, public domain, a U.S. government work), compacted to
// {"<ZIP>": [lat, lng]} using each ZCTA's internal point (INTPTLAT / INTPTLONG), rounded to
// 3 decimals (about 100 m). 33,791 ZIPs. It ships with the site; no outside call is made.
// A ZCTA is the Census's area for a ZIP; PO-box-only ZIPs have none and answer null here.
let table = null;
const load = () => (table ||= require("./zip-centroids.json"));

const EARTH_MILES = 3958.8;
const RAD = Math.PI / 180;

const zip5 = value => String(value ?? "").replace(/\D/g, "").slice(0, 5);

function centroid(zip) {
  const z = zip5(zip);
  if (z.length !== 5) return null;
  const point = load()[z];
  return Array.isArray(point) ? { lat: point[0], lng: point[1] } : null;
}

// Great-circle (haversine) distance in miles. null when either ZIP is unknown.
function milesBetween(a, b) {
  const p = centroid(a);
  const q = centroid(b);
  if (!p || !q) return null;
  const dLat = (q.lat - p.lat) * RAD;
  const dLng = (q.lng - p.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * RAD) * Math.cos(q.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

module.exports = { centroid, milesBetween, zip5 };
