import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';
import { parseCsvLine, parsePstToIso } from '../../src/bcgovCsv';

// Direct from the source: BC Ministry of Environment's own hourly-refreshed CSV feed,
// no API key needed. This is the same underlying data OpenAQ re-publishes (via AirNow's
// ingestion), just one hop closer to the origin and without OpenAQ's occasional lag.
const CSV_URL = 'https://www.env.gov.bc.ca/epd/bcairquality/aqo/csv/bc_air_monitoring_stations.csv';
const RADIUS_KM = 60;

export const handler: Handler = async () => {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) {
      return json({ name: 'BC Government (Air Quality)', available: false, error: `HTTP ${res.status}`, baseWeight: 0.35, includeInBlend: true });
    }
    const text = await res.text();
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const header = parseCsvLine(lines[0]);
    const idx = (name: string) => header.indexOf(name);

    const latIdx = idx('LATITUDE');
    const lonIdx = idx('LONGITUDE');
    const pm25Idx = idx('PM25');
    const nameIdx = idx('STATION_NAME');
    const dateIdx = idx('DATE_PST');
    const emsIdx = idx('EMS_ID');

    const stations = lines
      .slice(1)
      .map((line) => parseCsvLine(line))
      .map((f) => ({
        name: f[nameIdx],
        emsId: f[emsIdx],
        lat: parseFloat(f[latIdx]),
        lon: parseFloat(f[lonIdx]),
        pm25: parseFloat(f[pm25Idx]),
        datePst: f[dateIdx],
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Number.isFinite(s.pm25))
      .map((s) => ({ ...s, distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, s.lat, s.lon) }))
      .filter((s) => s.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearest = stations[0];
    if (!nearest) {
      return json({ name: 'BC Government (Air Quality)', available: false, error: 'No reporting stations within range', baseWeight: 0.35, includeInBlend: true });
    }

    return json({
      name: 'BC Government (Air Quality)',
      available: true,
      pm25: nearest.pm25,
      distanceKm: Math.round(nearest.distanceKm * 10) / 10,
      stationName: nearest.name,
      emsId: nearest.emsId,
      updated: parsePstToIso(nearest.datePst),
      baseWeight: 0.35,
      includeInBlend: true,
    });
  } catch (err: any) {
    return json({ name: 'BC Government (Air Quality)', available: false, error: err.message ?? 'Fetch failed', baseWeight: 0.35, includeInBlend: true });
  }
};

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
