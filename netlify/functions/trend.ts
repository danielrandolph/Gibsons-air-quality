import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { getRecentPoints } from '../../src/trendStore';

const HOURS = 12;

// Serves the app's own blended PM2.5 history (saved by blend.ts on every request and by
// the collect-trend scheduled function), so the trend line always matches the headline
// score exactly - it's the same number, just saved over time.
export const handler: Handler = async (event) => {
  try {
    connectLambda(event as any);
    const points = await getRecentPoints(HOURS);
    if (points.length < 2) {
      return json({ available: false, error: 'Not enough history collected yet', points: [] });
    }
    return json({ available: true, points });
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
