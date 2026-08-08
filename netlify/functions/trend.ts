import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';
import { correctPurpleAir } from '../../src/aqi';

const RADIUS_KM = 20;
const DEG_PAD = RADIUS_KM / 90;
const HOURS = 12;

export const handler: Handler = async () => {
  const apiKey = process.env.PURPLEAIR_API_KEY;
  if (!apiKey) {
    return json({ available: false, error: 'No API key configured', points: [] });
  }

  try {
    const nwLat = GIBSONS.lat + DEG_PAD;
    const nwLon = GIBSONS.lon - DEG_PAD;
    const seLat = GIBSONS.lat - DEG_PAD;
    const seLon = GIBSONS.lon + DEG_PAD;
    const nearbyUrl = `https://api.purpleair.com/v1/sensors?fields=name,latitude,longitude&nwlat=${nwLat}&nwlng=${nwLon}&selat=${seLat}&selng=${seLon}&location_type=0`;
    const nearbyRes = await fetch(nearbyUrl, { headers: { 'X-API-Key': apiKey } });
    if (!nearbyRes.ok) {
      return json({ available: false, error: `HTTP ${nearbyRes.status}`, points: [] });
    }
    const nearbyData = await nearbyRes.json();
    const fields: string[] = nearbyData.fields;
    const idx = (f: string) => fields.indexOf(f);

    const nearest = (nearbyData.data ?? [])
      .filter((row: any[]) => row[idx('latitude')] != null && row[idx('longitude')] != null)
      .map((row: any[]) => ({
        sensorIndex: row[idx('sensor_index')],
        name: row[idx('name')],
        distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, row[idx('latitude')], row[idx('longitude')]),
      }))
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)[0];

    if (!nearest) {
      return json({ available: false, error: 'No sensors within range', points: [] });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - HOURS * 3600;
    const historyUrl = `https://api.purpleair.com/v1/sensors/${nearest.sensorIndex}/history?start_timestamp=${startSec}&end_timestamp=${nowSec}&average=60&fields=pm2.5_cf_1,humidity`;
    const historyRes = await fetch(historyUrl, { headers: { 'X-API-Key': apiKey } });
    if (!historyRes.ok) {
      return json({ available: false, error: `HTTP ${historyRes.status}`, points: [] });
    }
    const historyData = await historyRes.json();
    const hFields: string[] = historyData.fields;
    const hIdx = (f: string) => hFields.indexOf(f);

    const points = (historyData.data ?? [])
      .filter((row: any[]) => row[hIdx('pm2.5_cf_1')] != null)
      .map((row: any[]) => {
        const rh = row[hIdx('humidity')] ?? 50;
        const pm25 = correctPurpleAir(row[hIdx('pm2.5_cf_1')], rh);
        return { t: new Date(row[hIdx('time_stamp')] * 1000).toISOString(), pm25: Math.round(pm25 * 10) / 10 };
      })
      .sort((a: any, b: any) => a.t.localeCompare(b.t));

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
