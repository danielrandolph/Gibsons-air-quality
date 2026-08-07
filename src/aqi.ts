// US EPA PM2.5 -> AQI breakpoints (2024 revision, µg/m3)
const BREAKPOINTS = [
  { pmLo: 0.0, pmHi: 9.0, aqiLo: 0, aqiHi: 50 },
  { pmLo: 9.1, pmHi: 35.4, aqiLo: 51, aqiHi: 100 },
  { pmLo: 35.5, pmHi: 55.4, aqiLo: 101, aqiHi: 150 },
  { pmLo: 55.5, pmHi: 125.4, aqiLo: 151, aqiHi: 200 },
  { pmLo: 125.5, pmHi: 225.4, aqiLo: 201, aqiHi: 300 },
  { pmLo: 225.5, pmHi: 325.4, aqiLo: 301, aqiHi: 400 },
  { pmLo: 325.5, pmHi: 500.4, aqiLo: 401, aqiHi: 500 },
];

export interface AqiResult {
  aqi: number;
  category: string;
  color: string;
}

export function pm25ToAqi(pm25: number): AqiResult {
  const clamped = Math.max(0, pm25);
  const bp = BREAKPOINTS.find((b) => clamped <= b.pmHi) ?? BREAKPOINTS[BREAKPOINTS.length - 1];
  const aqi = Math.round(
    ((bp.aqiHi - bp.aqiLo) / (bp.pmHi - bp.pmLo)) * (clamped - bp.pmLo) + bp.aqiLo,
  );
  return { aqi, ...categoryFor(aqi) };
}

export function categoryFor(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: 'Good', color: '#00e400' };
  if (aqi <= 100) return { category: 'Moderate', color: '#ffff00' };
  if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: '#ff7e00' };
  if (aqi <= 200) return { category: 'Unhealthy', color: '#ff0000' };
  if (aqi <= 300) return { category: 'Very Unhealthy', color: '#8f3f97' };
  return { category: 'Hazardous', color: '#7e0023' };
}

export function aqhiCategory(aqhi: number): { category: string; color: string } {
  if (aqhi <= 3) return { category: 'Low Risk', color: '#00cc00' };
  if (aqhi <= 6) return { category: 'Moderate Risk', color: '#ffcc00' };
  if (aqhi <= 10) return { category: 'High Risk', color: '#ff6600' };
  return { category: 'Very High Risk', color: '#990000' };
}

// US EPA / Barkjohn et al. (2021) correction for PurpleAir during wildfire smoke.
// pm25cf1: CF=1 channel average of A/B sensors. rh: relative humidity (%).
export function correctPurpleAir(pm25cf1: number, rh: number): number {
  const corrected = 0.524 * pm25cf1 - 0.0862 * rh + 5.75;
  return Math.max(0, corrected);
}
