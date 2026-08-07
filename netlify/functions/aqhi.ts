import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';
import { aqhiCategory } from '../../src/aqi';

// AQHI is a composite index (PM2.5 + NO2 + O3), not a PM2.5 mass concentration,
// so it's shown as a reference reading rather than blended numerically into the PM2.5 average.
const BBOX = '-125.5,48.4,-122.4,50.5'; // covers all BC South Coast AQHI stations

export const handler: Handler = async () => {
  try {
    const url = `https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?bbox=${BBOX}&limit=200&f=json`;
    const res = await fetch(url);
    if (!res.ok) {
      return json({ name: 'Environment Canada (AQHI)', available: false, error: `HTTP ${res.status}`, baseWeight: 0, includeInBlend: false });
    }
    const data = await res.json();
    const features = data.features ?? [];

    // group by station, keep most recent observation per station
    const latestByStation = new Map<string, any>();
    for (const f of features) {
      const p = f.properties;
      const existing = latestByStation.get(p.location_id);
      if (!existing || p.observation_datetime > existing.properties.observation_datetime) {
        latestByStation.set(p.location_id, f);
      }
    }

    const stations = Array.from(latestByStation.values())
      .filter((f) => f.properties.aqhi != null)
      .map((f) => ({
        id: f.properties.location_id,
        name: f.properties.location_name_en,
        aqhi: f.properties.aqhi as number,
        observedAt: f.properties.observation_datetime as string,
        distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (stations.length === 0) {
      return json({ name: 'Environment Canada (AQHI)', available: false, error: 'No stations found', baseWeight: 0, includeInBlend: false });
    }

    const nearest = stations[0];
    const { category, color } = aqhiCategory(nearest.aqhi);

    return json({
      name: 'Environment Canada (AQHI)',
      available: true,
      aqhi: nearest.aqhi,
      category,
      color,
      distanceKm: Math.round(nearest.distanceKm * 10) / 10,
      stationName: nearest.name,
      updated: nearest.observedAt,
      baseWeight: 0,
      includeInBlend: false,
    });
  } catch (err: any) {
    return json({ name: 'Environment Canada (AQHI)', available: false, error: err.message ?? 'Fetch failed', baseWeight: 0, includeInBlend: false });
  }
};

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
