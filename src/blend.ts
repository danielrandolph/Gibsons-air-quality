import { pm25ToAqi } from './aqi';

export interface SourceReading {
  name: string;
  available: boolean;
  pm25?: number;
  distanceKm?: number;
  stationName?: string;
  updated?: string;
  error?: string;
  baseWeight: number;
  includeInBlend: boolean;
}

export interface BlendResult {
  pm25: number;
  aqi: number;
  category: string;
  color: string;
  sourceCount: number;
  sources: SourceReading[];
}

export function blend(sources: SourceReading[]): BlendResult {
  const usable = sources.filter((s) => s.available && s.includeInBlend && s.pm25 !== undefined);
  const totalWeight = usable.reduce((sum, s) => sum + s.baseWeight, 0);

  let pm25: number;
  if (usable.length === 0) {
    pm25 = 0;
  } else if (totalWeight === 0) {
    pm25 = usable.reduce((sum, s) => sum + (s.pm25 ?? 0), 0) / usable.length;
  } else {
    pm25 = usable.reduce((sum, s) => sum + (s.pm25 ?? 0) * s.baseWeight, 0) / totalWeight;
  }

  const { aqi, category, color } = pm25ToAqi(pm25);

  return {
    pm25: Math.round(pm25 * 10) / 10,
    aqi,
    category,
    color,
    sourceCount: usable.length,
    sources,
  };
}
