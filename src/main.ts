import './style.css';
import type { BlendResult, SourceReading } from './blend';

const REFRESH_MS = 10 * 60 * 1000; // 10 minutes, per PurpleAir's polling guidance

const app = document.getElementById('app')!;

async function load() {
  try {
    const res = await fetch('/api/blend');
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    const data: BlendResult & { generatedAt: string } = await res.json();
    render(data);
  } catch (err: any) {
    renderError(err.message ?? 'Failed to load air quality data');
  }
}

function render(data: BlendResult & { generatedAt: string }) {
  const updated = new Date(data.generatedAt).toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const sourceCards = data.sources.map(renderSourceCard).join('');

  app.innerHTML = `
    <h1>Gibsons, BC — Air Quality</h1>
    <section class="headline" style="background:${data.color}1a; border: 1px solid ${data.color}55;">
      <div class="number" style="color:${data.color}">${data.sourceCount > 0 ? data.aqi : '—'}</div>
      <div class="category" style="color:${data.color}">${data.sourceCount > 0 ? data.category : 'No data available'}</div>
      ${data.sourceCount > 0 ? `<div class="pm25-line">${data.pm25} µg/m³ PM2.5 (corrected)</div>` : ''}
      <div class="meta">Blended from ${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'}</div>
    </section>
    <div class="sources">${sourceCards}</div>
    <div class="actions"><button id="refresh-btn">Refresh</button></div>
    <div class="updated-at">Last updated ${updated}</div>
    <div class="links">
      <span>More detail:</span>
      <a href="https://map.purpleair.com/air-quality-british-columbia-pm25/canada/british-columbia/sunshine-coast-regional-district/gibsons" target="_blank" rel="noopener">PurpleAir map</a>
      <a href="https://firesmoke.ca/forecasts/current/" target="_blank" rel="noopener">FireSmoke.ca smoke forecast</a>
      <a href="https://fire.airnow.gov/" target="_blank" rel="noopener">AirNow Fire &amp; Smoke Map</a>
    </div>
  `;

  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    app.innerHTML = '<p class="loading">Refreshing…</p>';
    load();
  });
}

function renderSourceCard(s: SourceReading & { aqhi?: number; category?: string; color?: string }): string {
  if (!s.available) {
    return `
      <div class="source-card unavailable">
        <div>
          <div class="source-name">${s.name}</div>
          <div class="source-detail">${s.error ?? 'Unavailable'}</div>
        </div>
        <div class="source-badge">off</div>
      </div>
    `;
  }

  const isAqhi = s.aqhi != null;
  const value = isAqhi ? s.aqhi : s.pm25 != null ? `${s.pm25}` : '—';
  const unit = isAqhi ? 'AQHI' : 'µg/m³';
  const color = s.color ?? '#f4f6f8';
  const detailParts = [s.stationName, s.distanceKm != null ? `${s.distanceKm} km away` : null].filter(Boolean);

  return `
    <div class="source-card">
      <div>
        <div class="source-name">${s.name}</div>
        <div class="source-detail">${detailParts.join(' · ')}</div>
        ${!s.includeInBlend ? '<div class="source-badge">reference only</div>' : ''}
      </div>
      <div class="source-value" style="color:${color}">${value} <span style="font-size:0.6em;opacity:0.7">${unit}</span></div>
    </div>
  `;
}

function renderError(message: string) {
  app.innerHTML = `
    <h1>Gibsons, BC — Air Quality</h1>
    <div class="error-banner">${message}</div>
    <div class="actions"><button id="retry-btn">Retry</button></div>
  `;
  document.getElementById('retry-btn')?.addEventListener('click', load);
}

load();
setInterval(load, REFRESH_MS);
