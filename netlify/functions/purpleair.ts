import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';
import { correctPurpleAir } from '../../src/aqi';

const RADIUS_KM = 20;
// crude bounding box padding in degrees for the given radius at this latitude
const DEG_PAD = RADIUS_KM / 90;

interface PurpleAirSensor {
  sensor_index: number;
  name: string;
  latitude: number;
  longitude: number;
  pm2_5_cf_1?: number;
  humidity?: number;
  last_seen?: number;
}

export const handler: Handler = async () => {
  const apiKey = process.env.PURPLEAIR_API_KEY;
  if (!apiKey) {
    return json({ name: 'PurpleAir', available: false, error: 'No API key configured', baseWeight: 0.5, includeInBlend: true });
  }

  const fields = 'name,latitude,longitude,pm2.5_cf_1,humidity,last_seen';
  const nwLat = GIBSONS.lat + DEG_PAD;
  const nwLon = GIBSONS.lon - DEG_PAD;
  const seLat = GIBSONS.lat - DEG_PAD;
  const seLon = GIBSONS.lon + DEG_PAD;

  const url = `https://api.purpleair.com/v1/sensors?fields=${encodeURIComponent(fields)}&nwlat=${nwLat}&nwlng=${nwLon}&selat=${seLat}&selng=${seLon}&location_type=0`;

  try {
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
    if (!res.ok) {
      return json({ name: 'PurpleAir', available: false, error: `HTTP ${res.status}`, baseWeight: 0.5, includeInBlend: true });
    }
    const data = await res.json();
    const fieldsIdx: string[] = data.fields;
    const idx = (f: string) => fieldsIdx.indexOf(f);

    const sensors: PurpleAirSensor[] = (data.data ?? []).map((row: any[]) => ({
      sensor_index: row[idx('sensor_index')],
      name: row[idx('name')],
      latitude: row[idx('latitude')],
      longitude: row[idx('longitude')],
      pm2_5_cf_1: row[idx('pm2.5_cf_1')],
      humidity: row[idx('humidity')],
      last_seen: row[idx('last_seen')],
    }));

    const now = Date.now() / 1000;
    const withinRange = sensors
      .filter((s) => s.latitude != null && s.longitude != null && s.pm2_5_cf_1 != null)
      .filter((s) => !s.last_seen || now - s.last_seen < 3600) // drop stale (>1hr) readings
      .map((s) => ({
        ...s,
        distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, s.latitude, s.longitude),
      }))
      .filter((s) => s.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withinRange.length === 0) {
      return json({ name: 'PurpleAir', available: false, error: 'No sensors within range', baseWeight: 0.5, includeInBlend: true });
    }

    // inverse-distance-weighted average of nearby sensors (cap distance floor to avoid div/0)
    const nearest = withinRange.slice(0, 8);
    let weightSum = 0;
    let pmSum = 0;
    for (const s of nearest) {
      const rh = s.humidity ?? 50;
      const corrected = correctPurpleAir(s.pm2_5_cf_1 as number, rh);
      const w = 1 / Math.max(s.distanceKm, 0.5);
      weightSum += w;
      pmSum += corrected * w;
    }
    const pm25 = pmSum / weightSum;

    return json({
      name: 'PurpleAir',
      available: true,
      pm25: Math.round(pm25 * 10) / 10,
      distanceKm: Math.round(nearest[0].distanceKm * 10) / 10,
      stationName: `${nearest.length} sensor(s), nearest: ${nearest[0].name}`,
      updated: new Date().toISOString(),
      baseWeight: 0.5,
      includeInBlend: true,
    });
  } catch (err: any) {
    return json({ name: 'PurpleAir', available: false, error: err.message ?? 'Fetch failed', baseWeight: 0.5, includeInBlend: true });
  }
};

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
