import { schedule } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { appendPoint } from '../../src/trendStore';
import { computeBlend } from './blend';

// Runs independently of page views so the trend has continuous coverage even if
// nobody opens the app for a few hours.
export const handler = schedule('*/15 * * * *', async (event) => {
  connectLambda(event as any);
  const result = await computeBlend();
  if (result.sourceCount > 0) {
    await appendPoint({ t: new Date().toISOString(), pm25: result.pm25 });
  }
  return { statusCode: 200 };
});
