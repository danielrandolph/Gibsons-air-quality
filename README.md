# Gibsons Air Quality

A single-page app that blends PurpleAir (wildfire-smoke-corrected), Environment Canada's AQHI, and IQAir into one "best estimate" air quality reading for Gibsons, BC — plus an optional OpenAQ cross-check.

## Why a blend?

Low-cost sensors like PurpleAir overestimate PM2.5 during wildfire smoke because their optical sensors are thrown off by humidity and smoke particle size. This app applies the same US EPA (Barkjohn et al. 2021) correction that AirNow's Fire and Smoke Map uses:

```
PM2.5_corrected = 0.524 × PM2.5_cf1 − 0.0862 × RH + 5.75
```

The headline number is a distance-weighted blend of corrected PurpleAir readings (weight 0.7) and IQAir's nearest station (weight 0.3), converted to the familiar US AQI 0–500 scale. Environment Canada's AQHI is a different, composite index (not a PM2.5 mass concentration), so it's shown as a reference reading rather than blended in. OpenAQ is shown the same way, as a bonus cross-check — coverage in this area tends to be thin.

If a source is unavailable, the remaining sources' weights are automatically renormalized.

## Setup

### 1. Get API keys (free)

**PurpleAir** (required — this is the primary, hyperlocal source):
1. Go to https://develop.purpleair.com and sign in with Google.
2. Go to "Keys" → create a new **Read** key.
3. Copy it.

**IQAir** (optional but recommended):
1. Go to https://www.iqair.com/air-pollution-data-api and sign up for the free Community plan.
2. Copy your API key from the dashboard.

**OpenAQ** (optional, bonus source only):
1. Go to https://explore.openaq.org/register and register.
2. Copy your API key.

### 2. Configure locally

```bash
cp .env.example .env
```

Fill in the keys you have. Any key you skip just means that source shows as unavailable — the app still works with what's available.

### 3. Install and run locally

```bash
npm install
npm run netlify-dev
```

This uses the Netlify CLI (`netlify dev`) to run Vite and the serverless functions together at `http://localhost:8888`.

### 4. Deploy to Netlify

```bash
npx netlify init
```

Follow the prompts to link/create a site. Then add your API keys as environment variables:

```bash
npx netlify env:set PURPLEAIR_API_KEY your_key_here
npx netlify env:set IQAIR_API_KEY your_key_here
npx netlify env:set OPENAQ_API_KEY your_key_here
```

Then deploy:

```bash
npx netlify deploy --prod
```

Open the deployed URL on your phone and bookmark it — that's your daily Gibsons air quality check.

## Notes

- Auto-refreshes every 10 minutes (PurpleAir's suggested polling interval).
- FireSmoke.ca and AirNow's Fire and Smoke Map are linked at the bottom of the page rather than integrated directly — FireSmoke only publishes NetCDF/KMZ grid files (no simple API), and AirNow's API coverage of Canada is unreliable.
