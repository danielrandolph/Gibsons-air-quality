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

// Colors are the shared Sunshine Coast Software Co. design system's tint
// scale (see design-system/design.md in gibsons-bc-projects), not the raw
// EPA/AQHI standard hues — those clash with the seafoam/terracotta palette
// used across the other apps (e.g. a pure #00e400 "Good" green next to
// langdale-ferry's muted seafoam "Open" pill). Good/USG/Unhealthy reuse the
// existing seafoam/terracotta/bad tokens directly; Moderate/Very
// Unhealthy/Hazardous are new tokens (--tint-amber/--tint-purple/
// --tint-maroon) built at the same muted saturation to stay in-family.
export function categoryFor(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: 'Good', color: '#3d9c82' };
  if (aqi <= 100) return { category: 'Moderate', color: '#c08c2a' };
  if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: '#c0562a' };
  if (aqi <= 200) return { category: 'Unhealthy', color: '#b3271e' };
  if (aqi <= 300) return { category: 'Very Unhealthy', color: '#7d5aa6' };
  return { category: 'Hazardous', color: '#7a2436' };
}

export function aqhiCategory(aqhi: number): { category: string; color: string } {
  if (aqhi <= 3) return { category: 'Low Risk', color: '#3d9c82' };
  if (aqhi <= 6) return { category: 'Moderate Risk', color: '#c08c2a' };
  if (aqhi <= 10) return { category: 'High Risk', color: '#c0562a' };
  return { category: 'Very High Risk', color: '#b3271e' };
}

// US EPA / Barkjohn et al. (2021) correction for PurpleAir during wildfire smoke.
// pm25cf1: CF=1 channel average of A/B sensors. rh: relative humidity (%).
export function correctPurpleAir(pm25cf1: number, rh: number): number {
  const corrected = 0.524 * pm25cf1 - 0.0862 * rh + 5.75;
  return Math.max(0, corrected);
}
