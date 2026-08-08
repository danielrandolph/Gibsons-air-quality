export interface TrendPoint {
  t: string;
  pm25: number;
}

const WIDTH = 340;
const HEIGHT = 140;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PAD_X = 4;

export function renderTrendSection(points: TrendPoint[], color: string, stationName?: string): string {
  if (points.length < 2) {
    return `
      <section class="trend-section">
        <h2 class="trend-title">12-Hour PM2.5 Trend</h2>
        <p class="trend-empty">Not enough data yet to show a trend.</p>
      </section>
    `;
  }

  const values = points.map((p) => p.pm25);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const yMin = Math.max(0, rawMin - span * 0.15);
  const yMax = rawMax + span * 0.15;

  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pm25).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${PAD_TOP + plotH} L${x(0).toFixed(1)},${PAD_TOP + plotH} Z`;

  const gridTicks = [yMin, (yMin + yMax) / 2, yMax];
  const gridLines = gridTicks
    .map(
      (v) => `
      <line x1="${PAD_X}" y1="${y(v).toFixed(1)}" x2="${WIDTH - PAD_X}" y2="${y(v).toFixed(1)}" stroke="#2a3440" stroke-width="1" />
      <text x="${WIDTH - PAD_X}" y="${(y(v) - 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b7684">${Math.round(v)}</text>
    `,
    )
    .join('');

  const last = points[points.length - 1];
  const gradientId = 'trendFill';

  const firstLabel = formatHour(points[0].t);
  const midLabel = formatHour(points[Math.floor(points.length / 2)].t);
  const lastLabel = 'Now';

  return `
    <section class="trend-section">
      <h2 class="trend-title">12-Hour PM2.5 Trend${stationName ? ` <span class="trend-subtitle">· ${stationName}</span>` : ''}</h2>
      <div class="trend-chart-wrap">
        <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="trend-svg" id="trend-svg">
          <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
              <stop offset="100%" stop-color="${color}" stop-opacity="0" />
            </linearGradient>
          </defs>
          ${gridLines}
          <path d="${areaPath}" fill="url(#${gradientId})" stroke="none" />
          <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.pm25).toFixed(1)}" r="4.5" fill="${color}" stroke="#0b0f14" stroke-width="2" />
          <line id="trend-crosshair" x1="0" y1="${PAD_TOP}" x2="0" y2="${PAD_TOP + plotH}" stroke="#f4f6f8" stroke-width="1" opacity="0" />
          <rect id="trend-hover-target" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="transparent" />
        </svg>
        <div id="trend-tooltip" class="trend-tooltip" hidden></div>
      </div>
      <div class="trend-x-labels">
        <span>${firstLabel}</span>
        <span>${midLabel}</span>
        <span>${lastLabel}</span>
      </div>
    </section>
  `;
}

export function attachTrendInteraction(points: TrendPoint[]) {
  const svg = document.getElementById('trend-svg') as unknown as SVGSVGElement | null;
  const hoverTarget = document.getElementById('trend-hover-target');
  const crosshair = document.getElementById('trend-crosshair');
  const tooltip = document.getElementById('trend-tooltip');
  if (!svg || !hoverTarget || !crosshair || !tooltip || points.length < 2) return;

  const plotW = WIDTH - PAD_X * 2;
  const x = (i: number) => PAD_X + (i / (points.length - 1)) * plotW;

  hoverTarget.addEventListener('mousemove', (evt) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = ((evt as MouseEvent).clientX - rect.left) * (WIDTH / rect.width);
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - mouseX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    const p = points[nearest];
    crosshair.setAttribute('x1', x(nearest).toFixed(1));
    crosshair.setAttribute('x2', x(nearest).toFixed(1));
    crosshair.setAttribute('opacity', '1');
    tooltip.hidden = false;
    tooltip.textContent = `${formatHour(p.t)} · ${p.pm25} µg/m³`;
    const rectWrap = (svg.parentElement as HTMLElement).getBoundingClientRect();
    const px = (x(nearest) / WIDTH) * rectWrap.width;
    tooltip.style.left = `${Math.min(Math.max(px, 40), rectWrap.width - 40)}px`;
  });

  hoverTarget.addEventListener('mouseleave', () => {
    crosshair.setAttribute('opacity', '0');
    tooltip.hidden = true;
  });
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric' });
}
