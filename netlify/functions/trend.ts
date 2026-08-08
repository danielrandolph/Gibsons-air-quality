import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';
import { parseCsvLine, parsePstToIso } from '../../src/bcgovCsv';

// Historical trend comes from the same BC government feed as the "BC Government (Air
// Quality)" card, not PurpleAir's history endpoint — PurpleAir's /history data for this
// sensor turned out to be wildly inconsistent with its own current-reading endpoint
// (reporting ~1300µg/m3 vs. ~13µg/m3 for the same sensor at the same time), so it can't
// be trusted for a trend line. The BC gov feed's current and historical values agree.
const STATIONS_URL = 'https://www.env.gov.bc.ca/epd/bcairquality/aqo/csv/bc_air_monitoring_stations.csv';
const HISTORY_URL = 'https://www.env.gov.bc.ca/epd/bcairquality/aqo/csv/Hourly_Raw_Air_Data/Air_Quality/PM25.csv';
const RADIUS_KM = 60;
const HOURS = 12;

export const handler: Handler = async () => {
  try {
    const stationsRes = await fetch(STATIONS_URL);
    if (!stationsRes.ok) {
      return json({ available: false, error: `HTTP ${stationsRes.status}`, points: [] });
    }
    const stationsText = await stationsRes.text();
    const stationLines = stationsText.split('\n').filter((l) => l.trim().length > 0);
    const header = parseCsvLine(stationLines[0]);
    const idx = (name: string) => header.indexOf(name);
    const latIdx = idx('LATITUDE');
    const lonIdx = idx('LONGITUDE');
    const pm25Idx = idx('PM25');
    const nameIdx = idx('STATION_NAME');
    const emsIdx = idx('EMS_ID');

    const nearest = stationLines
      .slice(1)
      .map((line) => parseCsvLine(line))
      .map((f) => ({
        name: f[nameIdx],
        emsId: f[emsIdx],
        lat: parseFloat(f[latIdx]),
        lon: parseFloat(f[lonIdx]),
        pm25: parseFloat(f[pm25Idx]),
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Number.isFinite(s.pm25))
      .map((s) => ({ ...s, distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, s.lat, s.lon) }))
      .filter((s) => s.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    if (!nearest) {
      return json({ available: false, error: 'No reporting stations within range', points: [] });
    }

    const historyRes = await fetch(HISTORY_URL);
    if (!historyRes.ok) {
      return json({ available: false, error: `History HTTP ${historyRes.status}`, points: [] });
    }
    const historyText = await historyRes.text();
    const historyLines = historyText.split('\n').filter((l) => l.trim().length > 0);
    const hHeader = parseCsvLine(historyLines[0]);
    const hIdx = (name: string) => hHeader.indexOf(name);
    const dateIdx = hIdx('DATE_PST');
    const emsHistIdx = hIdx('EMS_ID');
    const valueIdx = hIdx('REPORTED_VALUE');

    const cutoff = Date.now() - HOURS * 3600 * 1000;

    const points = historyLines
      .slice(1)
      .map((line) => parseCsvLine(line))
      .filter((f) => f[emsHistIdx] === nearest.emsId)
      .map((f) => ({ t: parsePstToIso(f[dateIdx]), pm25: parseFloat(f[valueIdx]) }))
      .filter((p): p is { t: string; pm25: number } => !!p.t && Number.isFinite(p.pm25))
      .filter((p) => new Date(p.t).getTime() >= cutoff)
      .sort((a, b) => a.t.localeCompare(b.t));

    if (points.length < 2) {
      return json({ available: false, error: 'Not enough recent history for this station', points: [] });
    }

    return json({ available: true, stationName: nearest.name, points });
  } catch (err: any) {
    return json({ available: false, error: err.message ?? 'Fetch failed', points: [] });
  }
};

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
