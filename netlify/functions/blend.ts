import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { blend, type BlendResult, type SourceReading } from '../../src/blend';
import { appendPoint } from '../../src/trendStore';
import { handler as purpleAirHandler } from './purpleair';
import { handler as iqairHandler } from './iqair';
import { handler as aqhiHandler } from './aqhi';
import { handler as bcgovHandler } from './bcgov';

async function invoke(fn: Handler): Promise<SourceReading> {
  const result = await fn({} as any, {} as any, undefined as any);
  const res = result as { body: string };
  return JSON.parse(res.body);
}

export async function computeBlend(): Promise<BlendResult> {
  const [purpleair, iqair, aqhi, bcgov] = await Promise.all([
    invoke(purpleAirHandler),
    invoke(iqairHandler),
    invoke(aqhiHandler),
    invoke(bcgovHandler),
  ]);

  return blend([purpleair, iqair, bcgov, aqhi]);
}

export const handler: Handler = async (event) => {
  connectLambda(event as any);
  const result = await computeBlend();
  const generatedAt = new Date().toISOString();

  if (result.sourceCount > 0) {
    await appendPoint({ t: generatedAt, pm25: result.pm25 });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...result, generatedAt }),
  };
};
