import { pm25ToAqi } from './aqi';

export interface TrendPoint {
  t: string;
  pm25: number;
}

const WIDTH = 340;
const HEIGHT = 150;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PAD_X = 4;

// Same US EPA zone bands used for the headline score, drawn as faint background bands
// so the line visibly crosses from one zone into the next.
const ZONE_BANDS = [
  { from: 0, to: 50, color: '#00e400' },
  { from: 50, to: 100, color: '#ffff00' },
  { from: 100, to: 150, color: '#ff7e00' },
  { from: 150, to: 200, color: '#ff0000' },
  { from: 200, to: 300, color: '#8f3f97' },
  { from: 300, to: 500, color: '#7e0023' },
];

export function renderTrendSection(points: TrendPoint[], stationName?: string): string {
  if (points.length < 2) {
    return `
      <section class="trend-section">
        <h2 class="trend-title">12-Hour Air Quality Trend</h2>
        <p class="trend-empty">Not enough data yet to show a trend.</p>
      </section>
    `;
  }

  const readings = points.map((p) => pm25ToAqi(p.pm25));
  const values = readings.map((r) => r.aqi);
  const rawMax = Math.max(...values);

  const yMin = 0;
  const yMax = Math.max(rawMax * 1.15, 60);

  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const zoneRects = ZONE_BANDS.filter((z) => z.from <= yMax && z.to >= yMin)
    .map((z) => {
      const top = y(Math.min(z.to, yMax));
      const bottom = y(Math.max(z.from, yMin));
      return `<rect x="${PAD_X}" y="${top.toFixed(1)}" width="${plotW}" height="${(bottom - top).toFixed(1)}" fill="${z.color}" opacity="0.08" />`;
    })
    .join('');

  const segments = points
    .slice(0, -1)
    .map((_, i) => {
      const x1 = x(i).toFixed(1);
      const y1 = y(values[i]).toFixed(1);
      const x2 = x(i + 1).toFixed(1);
      const y2 = y(values[i + 1]).toFixed(1);
      const c1 = readings[i].color;
      const c2 = readings[i + 1].color;
      return `
        <linearGradient id="seg${i}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="url(#seg${i})" stroke-width="2.5" stroke-linecap="round" />
      `;
    })
    .join('');

  const linePath = points.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${PAD_TOP + plotH} L${x(0).toFixed(1)},${PAD_TOP + plotH} Z`;

  const gridTicks = [yMin, yMax / 2, yMax];
  const gridLines = gridTicks
    .map(
      (v) => `
      <line x1="${PAD_X}" y1="${y(v).toFixed(1)}" x2="${WIDTH - PAD_X}" y2="${y(v).toFixed(1)}" stroke="var(--border)" stroke-width="1" />
      <text x="${WIDTH - PAD_X}" y="${(y(v) - 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-faint)">${Math.round(v)}</text>
    `,
    )
    .join('');

  const lastReading = readings[readings.length - 1];
  const gradientId = 'trendFill';

  const firstLabel = formatHour(points[0].t);
  const midLabel = formatHour(points[Math.floor(points.length / 2)].t);
  const lastLabel = 'Now';

  const presentCategories = Array.from(new Map(readings.map((r) => [r.category, r.color])).entries());
  const legend = presentCategories
    .map(([category, color]) => `<span class="trend-legend-item"><span class="trend-legend-dot" style="background:${color}"></span>${category}</span>`)
    .join('');

  return `
    <section class="trend-section">
      <h2 class="trend-title">12-Hour Air Quality Trend${stationName ? ` <span class="trend-subtitle">· ${stationName}</span>` : ''}</h2>
      <div class="trend-chart-wrap">
        <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="trend-svg" id="trend-svg">
          <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${lastReading.color}" stop-opacity="0.3" />
              <stop offset="100%" stop-color="${lastReading.color}" stop-opacity="0" />
            </linearGradient>
          </defs>
          ${zoneRects}
          ${gridLines}
          <path d="${areaPath}" fill="url(#${gradientId})" stroke="none" />
          ${segments}
          <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="4.5" fill="${lastReading.color}" stroke="var(--bg)" stroke-width="2" />
          <line id="trend-crosshair" x1="0" y1="${PAD_TOP}" x2="0" y2="${PAD_TOP + plotH}" stroke="var(--text-primary)" stroke-width="1" opacity="0" />
          <rect id="trend-hover-target" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="transparent" />
        </svg>
        <div id="trend-tooltip" class="trend-tooltip" hidden></div>
      </div>
      <div class="trend-x-labels">
        <span>${firstLabel}</span>
        <span>${midLabel}</span>
        <span>${lastLabel}</span>
      </div>
      <div class="trend-legend">${legend}</div>
    </section>
  `;
}

export function attachTrendInteraction(points: TrendPoint[]) {
  const svg = document.getElementById('trend-svg') as unknown as SVGSVGElement | null;
  const hoverTarget = document.getElementById('trend-hover-target');
  const crosshair = document.getElementById('trend-crosshair');
  const tooltip = document.getElementById('trend-tooltip');
  if (!svg || !hoverTarget || !crosshair || !tooltip || points.length < 2) return;

  const readings = points.map((p) => pm25ToAqi(p.pm25));
  const plotW = WIDTH - PAD_X * 2;
  const x = (i: number) => PAD_X + (i / (points.length - 1)) * plotW;

  const updateAt = (clientX: number) => {
    const rect = svg.getBoundingClientRect();
    const posX = (clientX - rect.left) * (WIDTH / rect.width);
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - posX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    const r = readings[nearest];
    crosshair.setAttribute('x1', x(nearest).toFixed(1));
    crosshair.setAttribute('x2', x(nearest).toFixed(1));
    crosshair.setAttribute('opacity', '1');
    tooltip.hidden = false;
    tooltip.textContent = `${formatHour(points[nearest].t)} · ${r.aqi} ${r.category}`;
    const rectWrap = (svg.parentElement as HTMLElement).getBoundingClientRect();
    const px = (x(nearest) / WIDTH) * rectWrap.width;
    tooltip.style.left = `${Math.min(Math.max(px, 40), rectWrap.width - 40)}px`;
  };

  const hide = () => {
    crosshair.setAttribute('opacity', '0');
    tooltip.hidden = true;
  };

  hoverTarget.addEventListener('mousemove', (evt) => updateAt((evt as MouseEvent).clientX));
  hoverTarget.addEventListener('mouseleave', hide);

  hoverTarget.addEventListener(
    'touchstart',
    (evt) => {
      const touch = (evt as TouchEvent).touches[0];
      if (touch) updateAt(touch.clientX);
    },
    { passive: true },
  );
  hoverTarget.addEventListener(
    'touchmove',
    (evt) => {
      const touch = (evt as TouchEvent).touches[0];
      if (touch) {
        evt.preventDefault();
        updateAt(touch.clientX);
      }
    },
    { passive: false },
  );
  hoverTarget.addEventListener('touchend', hide);
  hoverTarget.addEventListener('touchcancel', hide);
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric' });
}
