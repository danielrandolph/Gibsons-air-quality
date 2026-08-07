import type { Handler } from '@netlify/functions';
import { GIBSONS, haversineKm } from '../../src/location';

// Government reference monitor (AirNow network, via OpenAQ). Included in the blend — for this
// user the nearest station (Langdale Elementary) is also the closest sensor to their house.
export const handler: Handler = async () => {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    return json({ name: 'OpenAQ', available: false, error: 'No API key configured', baseWeight: 0.35, includeInBlend: true });
  }

  const headers = { 'X-API-Key': apiKey };

  try {
    // v3 caps radius at 25000m and only supports order_by=id, so sort by distance ourselves.
    const locUrl = `https://api.openaq.org/v3/locations?coordinates=${GIBSONS.lat},${GIBSONS.lon}&radius=25000&parameters_id=2&limit=10`;
    const locRes = await fetch(locUrl, { headers });
    if (!locRes.ok) {
      return json({ name: 'OpenAQ', available: false, error: `HTTP ${locRes.status}`, baseWeight: 0.35, includeInBlend: true });
    }
    const locData = await locRes.json();
    const location = (locData.results ?? [])
      .map((loc: any) => ({
        ...loc,
        distanceKm: haversineKm(GIBSONS.lat, GIBSONS.lon, loc.coordinates?.latitude, loc.coordinates?.longitude),
      }))
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)[0];
    if (!location) {
      return json({ name: 'OpenAQ', available: false, error: 'No nearby stations', baseWeight: 0.35, includeInBlend: true });
    }

    const pm25Sensor = location.sensors?.find((s: any) => s.parameter?.name === 'pm25');
    if (!pm25Sensor) {
      return json({ name: 'OpenAQ', available: false, error: 'No PM2.5 sensor at nearest station', baseWeight: 0.35, includeInBlend: true });
    }

    // v3's "latest" endpoint is per-location (all sensors), not per-sensor — /v3/sensors/{id}/latest 404s.
    const latestUrl = `https://api.openaq.org/v3/locations/${location.id}/latest`;
    const latestRes = await fetch(latestUrl, { headers });
    const latestData = await latestRes.json();
    const latest = (latestData.results ?? []).find((r: any) => r.sensorsId === pm25Sensor.id);
    if (!latest) {
      return json({ name: 'OpenAQ', available: false, error: 'No recent measurement', baseWeight: 0.35, includeInBlend: true });
    }

    return json({
      name: 'OpenAQ',
      available: true,
      pm25: latest.value,
      stationName: location.name,
      updated: latest.datetime?.utc,
      baseWeight: 0.35,
      includeInBlend: true,
    });
  } catch (err: any) {
    return json({ name: 'OpenAQ', available: false, error: err.message ?? 'Fetch failed', baseWeight: 0.35, includeInBlend: true });
  }
};

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
