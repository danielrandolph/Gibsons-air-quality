import type { Handler } from '@netlify/functions';
import { GIBSONS } from '../../src/location';

export const handler: Handler = async () => {
  const apiKey = process.env.IQAIR_API_KEY;
  if (!apiKey) {
    return json({ name: 'IQAir', available: false, error: 'No API key configured', baseWeight: 0.3, includeInBlend: true });
  }

  const url = `https://api.airvisual.com/v2/nearest_city?lat=${GIBSONS.lat}&lon=${GIBSONS.lon}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'success') {
      return json({ name: 'IQAir', available: false, error: data.data?.message ?? `HTTP ${res.status}`, baseWeight: 0.3, includeInBlend: true });
    }

    const pollution = data.data?.current?.pollution;
    const pm25 = pollution?.aqius != null ? aqiUsToPm25(pollution.aqius) : undefined;

    if (pm25 === undefined) {
      return json({ name: 'IQAir', available: false, error: 'No pollution data returned', baseWeight: 0.3, includeInBlend: true });
    }

    return json({
      name: 'IQAir',
      available: true,
      pm25: Math.round(pm25 * 10) / 10,
      stationName: `${data.data.city}, ${data.data.state}`,
      updated: pollution.ts,
      baseWeight: 0.3,
      includeInBlend: true,
    });
  } catch (err: any) {
    return json({ name: 'IQAir', available: false, error: err.message ?? 'Fetch failed', baseWeight: 0.3, includeInBlend: true });
  }
};

// IQAir returns US AQI (aqius), not raw PM2.5. Invert the standard EPA breakpoints
// to recover an approximate PM2.5 concentration for blending on a consistent scale.
function aqiUsToPm25(aqi: number): number {
  const BREAKPOINTS = [
    { pmLo: 0.0, pmHi: 9.0, aqiLo: 0, aqiHi: 50 },
    { pmLo: 9.1, pmHi: 35.4, aqiLo: 51, aqiHi: 100 },
    { pmLo: 35.5, pmHi: 55.4, aqiLo: 101, aqiHi: 150 },
    { pmLo: 55.5, pmHi: 125.4, aqiLo: 151, aqiHi: 200 },
    { pmLo: 125.5, pmHi: 225.4, aqiLo: 201, aqiHi: 300 },
    { pmLo: 225.5, pmHi: 325.4, aqiLo: 301, aqiHi: 400 },
    { pmLo: 325.5, pmHi: 500.4, aqiLo: 401, aqiHi: 500 },
  ];
  const bp = BREAKPOINTS.find((b) => aqi <= b.aqiHi) ?? BREAKPOINTS[BREAKPOINTS.length - 1];
  return ((bp.pmHi - bp.pmLo) / (bp.aqiHi - bp.aqiLo)) * (aqi - bp.aqiLo) + bp.pmLo;
}

function json(body: unknown) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
